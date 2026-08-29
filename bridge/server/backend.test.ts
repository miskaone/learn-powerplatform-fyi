import { expect, test } from 'bun:test';
import { createBridgeBackend } from './backend';
import type { BridgeWsServer } from './ws';

function fakeWs(overrides: {
  isConnected?: boolean;
  isPaired?: boolean;
  pairedTabUrl?: string | null;
  listTools?: () => Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>>;
  callTool?: (
    name: string,
    args: unknown,
  ) => Promise<{ content: unknown[]; isError?: boolean }>;
}): BridgeWsServer {
  const ws = {
    get isConnected() {
      return overrides.isConnected ?? false;
    },
    get isPaired() {
      return overrides.isPaired ?? false;
    },
    get pairedTabUrl() {
      return overrides.pairedTabUrl ?? null;
    },
    async listTools() {
      if (overrides.listTools) return overrides.listTools();
      return [{ name: 't1', description: 'd', inputSchema: { type: 'object' } }];
    },
    async callTool(name: string, args: unknown) {
      if (overrides.callTool) return overrides.callTool(name, args);
      return { content: [{ type: 'text', text: 'ok' }] };
    },
  };
  return ws as never;
}

test('unpaired listTools returns exactly one tool named bridge_status', async () => {
  const ws = fakeWs({});
  const backend = createBridgeBackend(ws, () => {});
  const listed = await backend.listTools();
  expect(listed.tools).toHaveLength(1);
  expect(listed.tools[0].name).toBe('bridge_status');
});

test("unpaired callTool('get_current_question') is an isError result", async () => {
  const ws = fakeWs({});
  const backend = createBridgeBackend(ws, () => {});
  const result = await backend.callTool('get_current_question', {});
  expect(result.isError).toBe(true);
});

test("callTool('bridge_status') works when unpaired", async () => {
  const ws = fakeWs({});
  const backend = createBridgeBackend(ws, () => {});
  const result = await backend.callTool('bridge_status', {});
  expect(result.isError).toBeUndefined();
  expect(result.content).toHaveLength(1);
  const block = result.content[0] as { type: string; text: string };
  expect(block.type).toBe('text');
  expect(block.text).toContain('connected:');
});

test('paired listTools passes tools through unprefixed and re-queries each call', async () => {
  let listCalls = 0;
  const ws = {
    isConnected: true,
    isPaired: true,
    pairedTabUrl: 'https://learn.powerplatform.fyi/pl-400',
    async listTools() {
      listCalls += 1;
      return [{ name: 'get_current_question', description: 'd', inputSchema: { type: 'object' } }];
    },
    async callTool() {
      return { content: [] };
    },
  } as never;
  const backend = createBridgeBackend(ws, () => {});
  const first = await backend.listTools();
  const second = await backend.listTools();
  expect(first.tools).toEqual([
    { name: 'get_current_question', description: 'd', inputSchema: { type: 'object' } },
  ]);
  expect(second.tools).toEqual(first.tools);
  expect(listCalls).toBe(2);
});
