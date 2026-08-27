import { test, expect } from 'bun:test';
import {
  EventlessMockModelContext,
  MockModelContext,
} from './mock-model-context';
import { textResponse, type ToolDescriptor } from './model-context';
import { canonicalToolOrder, ALL_TOOL_NAMES } from './tool-names';
import { ToolSurfaceWatcher } from './tool-surface-watcher';

function makeTool(name: string): ToolDescriptor {
  return {
    name,
    description: `${name} tool`,
    inputSchema: { type: 'object' },
    execute: async () => textResponse({ name }),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// getTools() is a Promise on real runtimes; every read is awaited and the
// FIRST read emits (the UI wants the initial roster without waiting for a
// change). Tests below encode that contract.

test('events mode: initial emission on start, then notifies on register', async () => {
  const ctx = new MockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx);
  expect(watcher.mode).toBe('events');

  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  watcher.start();
  await wait(5);
  expect(seen).toEqual([[]]);

  ctx.registerTool(makeTool('alpha'));
  await wait(5);
  expect(seen).toEqual([[], ['alpha']]);

  watcher.stop();
  ctx.registerTool(makeTool('beta'));
  await wait(5);
  expect(seen).toEqual([[], ['alpha']]);
});

test('events mode unsubscribe removes only that callback', async () => {
  const ctx = new MockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx);
  const first: string[][] = [];
  const second: string[][] = [];
  const unsubscribeFirst = watcher.onChange((names) => {
    first.push(names);
  });
  watcher.onChange((names) => {
    second.push(names);
  });
  watcher.start();
  await wait(5);
  unsubscribeFirst();
  ctx.registerTool(makeTool('alpha'));
  await wait(5);
  expect(first).toEqual([[]]); // initial emission only, before unsubscribe
  expect(second).toEqual([[], ['alpha']]);
  watcher.stop();
});

test('polling mode reports polling and notifies on the next tick', async () => {
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  expect(watcher.mode).toBe('polling');

  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  watcher.start();
  ctx.registerTool(makeTool('alpha'));
  await wait(40);
  expect(seen.at(-1)).toEqual(['alpha']);

  const callsAfterFirstChange = seen.length;
  watcher.stop();
  ctx.registerTool(makeTool('beta'));
  await wait(40);
  expect(seen.length).toBe(callsAfterFirstChange);
});

test('refresh detects a change with no start', async () => {
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  ctx.registerTool(makeTool('alpha'));
  await watcher.refresh();
  expect(seen).toEqual([['alpha']]);
});

test('refresh is a no-op when tools have not changed since the last read', async () => {
  const ctx = new EventlessMockModelContext();
  ctx.registerTool(makeTool('alpha'));
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  await watcher.refresh();
  await watcher.refresh();
  expect(seen).toEqual([['alpha']]);
});

test('double start does not create a second interval', async () => {
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  let calls = 0;
  watcher.onChange(() => {
    calls += 1;
  });
  watcher.start();
  watcher.start();
  ctx.registerTool(makeTool('alpha'));
  await wait(40);
  // initial emission + the alpha change; a duplicated interval would add more
  expect(calls).toBe(2);
  watcher.stop();
});

test('polling mode detects abort unregistration on the next tick', async () => {
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  const controller = new AbortController();
  watcher.start();
  ctx.registerTool(makeTool('alpha'), { signal: controller.signal });
  await wait(40);
  expect(seen.at(-1)).toEqual(['alpha']);
  controller.abort();
  await wait(40);
  expect(seen.at(-1)).toEqual([]);
  watcher.stop();
});

test('promise-returning getTools is awaited, never mapped over (2026-08-27 production crash)', async () => {
  // The exact failure shape: a runtime whose getTools() returns a Promise.
  // The old sync contract ran `.map` on the Promise and threw
  // "e.getTools.map is not a function" on every poll tick, uncaught.
  let reads = 0;
  const ctx = {
    registerTool: () => Promise.resolve(),
    getTools: () => {
      reads += 1;
      return Promise.resolve([makeTool('alpha'), makeTool('beta')]);
    },
  };
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  expect(watcher.mode).toBe('polling');
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  await watcher.refresh();
  expect(seen).toEqual([['alpha', 'beta']]);
  expect(reads).toBe(1);
});

test('a rejecting getTools surfaces through onError, never as an uncaught throw', async () => {
  const errors: unknown[] = [];
  const ctx = {
    registerTool: () => {},
    getTools: () => Promise.reject(new Error('runtime hiccup')),
  };
  const watcher = new ToolSurfaceWatcher(ctx, {
    pollIntervalMs: 5,
    onError: (error) => {
      errors.push(error);
    },
  });
  await watcher.refresh();
  expect(errors).toHaveLength(1);
  expect(String(errors[0])).toContain('runtime hiccup');
});

test('roster ordering: watcher and registry.getRegisteredNames agree on canonical declaration order', async () => {
  // Regression (cross-review finding 7): the watcher used a plain
  // alphabetical sort while the registry used ALL_TOOL_NAMES declaration
  // order, so the on-page roster reshuffled between a sync-driven update and
  // the next poll tick. Both paths must yield IDENTICAL ordering for the
  // same tool set.
  const { ToolRegistry } = await import('./registry');
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });

  const stubEngine = new Proxy(
    {},
    {
      get:
        () =>
        () => {
          throw new Error('not called in this test');
        },
    },
  );
  const registry = new ToolRegistry(
    ctx,
    stubEngine as never,
  );
  await registry.sync({
    phase: 'practice',
    gatePassed: true,
    repeatedMisconceptionIds: ['mc-x'],
    predictionCommitted: false,
    examSubmitted: false,
    moduleComplete: true,
  });
  await watcher.refresh();

  const registryOrder = registry.getRegisteredNames();
  const watcherOrder = seen.at(-1);
  expect(watcherOrder).toEqual(registryOrder);
  // And the shared ordering really is declaration order, not alphabetical.
  const declarationIndex = new Map(
    ALL_TOOL_NAMES.map((name, index) => [name, index]),
  );
  const indices = registryOrder.map((name) => declarationIndex.get(name) ?? -1);
  expect([...indices].sort((a, b) => a - b)).toEqual(indices);
});

test('canonicalToolOrder: known tools by declaration order, unknown names alphabetical after', () => {
  const shuffled = [
    'zeta_custom',
    'submit_answer',
    'alpha_custom',
    'get_learner_state',
    'advance_module',
  ];
  expect(canonicalToolOrder(shuffled)).toEqual([
    'get_learner_state',
    'submit_answer',
    'advance_module',
    'alpha_custom',
    'zeta_custom',
  ]);
});
