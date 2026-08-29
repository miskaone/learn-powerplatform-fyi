import { expect, test } from 'bun:test';
import { createLineSplitter, createMcpCore, type McpBackend } from './mcp';

test('createLineSplitter handles a single line', () => {
  const split = createLineSplitter();
  expect(split('hello\n')).toEqual(['hello']);
});

test('createLineSplitter buffers a partial chunk then the rest', () => {
  const split = createLineSplitter();
  expect(split('hel')).toEqual([]);
  expect(split('lo\n')).toEqual(['hello']);
});

test('createLineSplitter splits three lines in one chunk', () => {
  const split = createLineSplitter();
  expect(split('a\nb\nc\n')).toEqual(['a', 'b', 'c']);
});

test('createLineSplitter strips CRLF', () => {
  const split = createLineSplitter();
  expect(split('hello\r\n')).toEqual(['hello']);
});

test('createLineSplitter skips blank and whitespace-only lines', () => {
  const split = createLineSplitter();
  expect(split('a\n\n  \n\t\nb\n')).toEqual(['a', 'b']);
});

function fakeBackend(): {
  backend: McpBackend;
  calls: Array<{ op: string; name?: string; args?: Record<string, unknown> }>;
} {
  const calls: Array<{ op: string; name?: string; args?: Record<string, unknown> }> = [];
  const backend: McpBackend = {
    async listTools() {
      calls.push({ op: 'list' });
      return {
        tools: [{ name: 't', description: 'd', inputSchema: { type: 'object' } }],
      };
    },
    async callTool(name, args) {
      calls.push({ op: 'call', name, args });
      if (name === 'boom') throw new Error('exploded');
      return { content: [{ type: 'text', text: 'ok' }] };
    },
  };
  return { backend, calls };
}

function coreWithFake() {
  const fake = fakeBackend();
  const logs: string[] = [];
  const core = createMcpCore(fake.backend, {
    serverName: 'webmcp-bridge',
    serverVersion: '0.1.0',
    log: (msg) => logs.push(msg),
  });
  return { core, fake, logs };
}

test('initialize echoes a known protocolVersion', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
    }),
  )) as Record<string, unknown>;
  const result = resp.result as Record<string, unknown>;
  expect(result.protocolVersion).toBe('2024-11-05');
  const capabilities = result.capabilities as { tools: { listChanged: boolean } };
  expect(capabilities.tools.listChanged).toBe(true);
  const serverInfo = result.serverInfo as { name: string; version: string };
  expect(serverInfo).toEqual({ name: 'webmcp-bridge', version: '0.1.0' });
});

test("initialize falls back to 2025-06-18 for unknown protocolVersion", async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '99.0', capabilities: {} },
    }),
  )) as Record<string, unknown>;
  const result = resp.result as Record<string, unknown>;
  expect(result.protocolVersion).toBe('2025-06-18');
});

test('notifications/initialized returns null', async () => {
  const { core } = coreWithFake();
  const resp = await core.handleLine(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  );
  expect(resp).toBeNull();
});

test('ping returns empty result', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }),
  )) as Record<string, unknown>;
  expect(resp).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
});

test('tools/list returns backend tools and echoes id', async () => {
  const { core, fake } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }),
  )) as Record<string, unknown>;
  expect(resp.id).toBe(7);
  expect(resp.result).toEqual({
    tools: [{ name: 't', description: 'd', inputSchema: { type: 'object' } }],
  });
  expect(fake.calls).toEqual([{ op: 'list' }]);
});

test('tools/call passes name and arguments to backend', async () => {
  const { core, fake } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'foo', arguments: { a: 1 } },
    }),
  )) as Record<string, unknown>;
  expect(fake.calls).toEqual([{ op: 'call', name: 'foo', args: { a: 1 } }]);
  expect(resp.result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
});

test('tools/call with missing name returns -32602', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { arguments: {} },
    }),
  )) as Record<string, unknown>;
  const error = resp.error as { code: number };
  expect(error.code).toBe(-32602);
});

test('tools/call backend throw becomes isError result, not JSON-RPC error', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'boom', arguments: {} },
    }),
  )) as Record<string, unknown>;
  expect(resp).not.toHaveProperty('error');
  const result = resp.result as {
    isError: boolean;
    content: Array<{ text: string }>;
  };
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('exploded');
});

test('unknown method with id returns -32601', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine(
    JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'no/such' }),
  )) as Record<string, unknown>;
  const error = resp.error as { code: number };
  expect(error.code).toBe(-32601);
});

test('invalid JSON line returns -32700 with id null', async () => {
  const { core } = coreWithFake();
  const resp = (await core.handleLine('not-json')) as Record<string, unknown>;
  expect(resp).toEqual({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
  });
});

test('makeToolListChangedNotification shape', () => {
  const { core } = coreWithFake();
  expect(core.makeToolListChangedNotification()).toEqual({
    jsonrpc: '2.0',
    method: 'notifications/tools/list_changed',
  });
});
