import { test, expect } from 'bun:test';
import {
  EventlessMockModelContext,
  MockModelContext,
} from './mock-model-context';
import { textResponse, type ToolDescriptor } from './model-context';

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function makeTool(
  name: string,
  response = textResponse({ name }),
): ToolDescriptor {
  return {
    name,
    description: `${name} tool`,
    inputSchema: { type: 'object' },
    execute: async (_input: unknown) => response,
  };
}

test('registerTool then getTools/getToolNames reflect the tool; callTool executes it', async () => {
  const ctx = new MockModelContext();
  const response = textResponse({ ok: true });
  const tool = makeTool('echo', response);
  ctx.registerTool(tool);
  expect(ctx.getToolNames()).toEqual(['echo']);
  expect(await ctx.getTools()).toEqual([tool]);
  expect(ctx.hasTool('echo')).toBe(true);
  const result = await ctx.callTool('echo', { q: 1 });
  expect(result).toBe(response);
});

test('duplicate registration throws', () => {
  const ctx = new MockModelContext();
  const tool = makeTool('echo');
  ctx.registerTool(tool);
  expect(
    throws(() => {
      ctx.registerTool(tool);
    }),
  ).toBe(true);
});

test('aborting a registration signal unregisters the tool and fires toolchange once more', async () => {
  const ctx = new MockModelContext();
  const controller = new AbortController();
  ctx.registerTool(makeTool('echo'), { signal: controller.signal });
  expect(ctx.toolchangeCount).toBe(1);
  expect(ctx.hasTool('echo')).toBe(true);
  controller.abort();
  expect(ctx.hasTool('echo')).toBe(false);
  expect(await ctx.getTools()).toEqual([]);
  expect(ctx.toolchangeCount).toBe(2);
});

test('pre-aborted signal registers nothing and does not dispatch toolchange', () => {
  const ctx = new MockModelContext();
  const controller = new AbortController();
  controller.abort();
  ctx.registerTool(makeTool('echo'), { signal: controller.signal });
  expect(ctx.getToolNames()).toEqual([]);
  expect(ctx.toolchangeCount).toBe(0);
});

test('toolchange listener fires on register and abort, and not after removeEventListener', () => {
  const ctx = new MockModelContext();
  const controller = new AbortController();
  let fires = 0;
  const listener = () => {
    fires += 1;
  };
  ctx.addEventListener('toolchange', listener);
  ctx.registerTool(makeTool('echo'), { signal: controller.signal });
  expect(fires).toBe(1);
  controller.abort();
  expect(fires).toBe(2);
  ctx.removeEventListener('toolchange', listener);
  ctx.registerTool(makeTool('other'));
  expect(fires).toBe(2);
});

test('callTool on unknown name throws', () => {
  const ctx = new MockModelContext();
  expect(
    throws(() => {
      void ctx.callTool('missing', {});
    }),
  ).toBe(true);
});

test('EventlessMockModelContext has no addEventListener or removeEventListener', () => {
  const ctx = new EventlessMockModelContext();
  expect('addEventListener' in ctx).toBe(false);
  expect('removeEventListener' in ctx).toBe(false);
  expect(typeof (ctx as { addEventListener?: unknown }).addEventListener).not.toBe(
    'function',
  );
});

test('EventlessMockModelContext register/getTools/abort match Mock without events', async () => {
  const ctx = new EventlessMockModelContext();
  const response = textResponse({ ok: true });
  const tool = makeTool('echo', response);
  ctx.registerTool(tool);
  expect(ctx.getToolNames()).toEqual(['echo']);
  expect(ctx.hasTool('echo')).toBe(true);
  expect(await ctx.callTool('echo', {})).toBe(response);

  expect(
    throws(() => {
      ctx.registerTool(tool);
    }),
  ).toBe(true);

  const controller = new AbortController();
  ctx.registerTool(makeTool('other'), { signal: controller.signal });
  expect(ctx.hasTool('other')).toBe(true);
  controller.abort();
  expect(ctx.hasTool('other')).toBe(false);
});
