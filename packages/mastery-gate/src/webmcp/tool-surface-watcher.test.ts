import { test, expect } from 'bun:test';
import {
  EventlessMockModelContext,
  MockModelContext,
} from './mock-model-context';
import { textResponse, type ToolDescriptor } from './model-context';
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

test('events mode reports events and notifies on register without waiting', () => {
  const ctx = new MockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx);
  expect(watcher.mode).toBe('events');

  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  watcher.start();
  ctx.registerTool(makeTool('alpha'));
  expect(seen).toEqual([['alpha']]);

  watcher.stop();
  ctx.registerTool(makeTool('beta'));
  expect(seen).toEqual([['alpha']]);
});

test('events mode unsubscribe removes only that callback', () => {
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
  unsubscribeFirst();
  ctx.registerTool(makeTool('alpha'));
  expect(first).toEqual([]);
  expect(second).toEqual([['alpha']]);
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
  expect(seen).toEqual([['alpha']]);

  const callsAfterFirstChange = seen.length;
  watcher.stop();
  ctx.registerTool(makeTool('beta'));
  await wait(40);
  expect(seen.length).toBe(callsAfterFirstChange);
});

test('refresh detects a change with no start', () => {
  const ctx = new EventlessMockModelContext();
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  ctx.registerTool(makeTool('alpha'));
  watcher.refresh();
  expect(seen).toEqual([['alpha']]);
});

test('constructor snapshot means refresh is a no-op when tools have not changed', () => {
  const ctx = new EventlessMockModelContext();
  ctx.registerTool(makeTool('alpha'));
  const watcher = new ToolSurfaceWatcher(ctx, { pollIntervalMs: 5 });
  const seen: string[][] = [];
  watcher.onChange((names) => {
    seen.push(names);
  });
  watcher.refresh();
  expect(seen).toEqual([]);
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
  expect(calls).toBe(1);
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
  expect(seen).toEqual([['alpha']]);
  controller.abort();
  await wait(40);
  expect(seen.at(-1)).toEqual([]);
  watcher.stop();
});
