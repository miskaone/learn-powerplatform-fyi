import { expect, test } from 'bun:test';
import {
  MAX_WS_MESSAGE_BYTES,
  parseExtMessage,
  parseToolCallResult,
  parseToolList,
} from './protocol';

test('parseExtMessage accepts valid hello (nonce, no token)', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'hello', clientNonce: 'ab12' }));
  expect(result).toEqual({ ok: true, msg: { type: 'hello', clientNonce: 'ab12' } });
});

test('parseExtMessage accepts hello with extensionVersion', () => {
  const result = parseExtMessage(
    JSON.stringify({ type: 'hello', clientNonce: 'ab12', extensionVersion: '1.0.0' }),
  );
  expect(result).toEqual({
    ok: true,
    msg: { type: 'hello', clientNonce: 'ab12', extensionVersion: '1.0.0' },
  });
});

test('parseExtMessage rejects hello carrying a token but no nonce', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'hello', token: 'abc' }));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.toLowerCase()).toContain('clientnonce');
});

test('parseExtMessage rejects hello with non-hex nonce', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'hello', clientNonce: 'not hex!' }));
  expect(result.ok).toBe(false);
});

test('parseExtMessage accepts valid hello_response (no token)', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'hello_response', clientProof: 'deadbeef' }));
  expect(result).toEqual({ ok: true, msg: { type: 'hello_response', clientProof: 'deadbeef' } });
});

test('parseExtMessage rejects hello_response with non-hex proof', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'hello_response', clientProof: 'zz' }));
  expect(result.ok).toBe(false);
});

test('parseExtMessage accepts valid paired', () => {
  const result = parseExtMessage(
    JSON.stringify({
      type: 'paired',
      token: 'abc',
      tab: { id: 42, url: 'https://learn.powerplatform.fyi' },
    }),
  );
  expect(result).toEqual({
    ok: true,
    msg: {
      type: 'paired',
      token: 'abc',
      tab: { id: 42, url: 'https://learn.powerplatform.fyi' },
    },
  });
});

test('parseExtMessage accepts valid disarmed', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'disarmed', token: 'abc' }));
  expect(result).toEqual({ ok: true, msg: { type: 'disarmed', token: 'abc' } });
});

test('parseExtMessage accepts valid tools_changed', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'tools_changed', token: 'abc' }));
  expect(result).toEqual({ ok: true, msg: { type: 'tools_changed', token: 'abc' } });
});

test('parseExtMessage accepts valid response', () => {
  const result = parseExtMessage(
    JSON.stringify({
      type: 'response',
      token: 'abc',
      id: '1',
      ok: true,
      result: { hello: 'world' },
    }),
  );
  expect(result).toEqual({
    ok: true,
    msg: { type: 'response', token: 'abc', id: '1', ok: true, result: { hello: 'world' } },
  });
});

test('parseExtMessage rejects unknown type', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'nope', token: 'abc' }));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('unknown type');
});

test('parseExtMessage rejects non-JSON', () => {
  const result = parseExtMessage('not-json');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('invalid JSON');
});

test('parseExtMessage rejects oversize messages', () => {
  const result = parseExtMessage('x'.repeat(MAX_WS_MESSAGE_BYTES + 1));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('message too large');
});

test('parseExtMessage rejects post-handshake frame missing token', () => {
  const result = parseExtMessage(JSON.stringify({ type: 'tools_changed' }));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.toLowerCase()).toContain('token');
});

test('parseExtMessage strips extra properties', () => {
  const result = parseExtMessage(
    JSON.stringify({ type: 'hello', clientNonce: 'ab12', extra: 1, foo: 'bar' }),
  );
  expect(result).toEqual({ ok: true, msg: { type: 'hello', clientNonce: 'ab12' } });
});

test('parseExtMessage rejects response with non-string id', () => {
  const result = parseExtMessage(
    JSON.stringify({ type: 'response', token: 'abc', id: 12, ok: true }),
  );
  expect(result.ok).toBe(false);
});

test('parseExtMessage rejects paired with non-numeric tab.id', () => {
  const result = parseExtMessage(
    JSON.stringify({
      type: 'paired',
      token: 'abc',
      tab: { id: '1', url: 'https://example.com' },
    }),
  );
  expect(result.ok).toBe(false);
});

test('parseToolList passes fields through and marks the description untrusted', () => {
  const result = parseToolList([
    {
      name: 't1',
      description: 'd',
      inputSchema: { type: 'object', properties: { x: { type: 'string' } } },
      extra: true,
    },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('t1');
    expect(result.tools[0].description).toContain('untrusted');
    expect(result.tools[0].description.endsWith('d')).toBe(true);
    expect(result.tools[0].inputSchema).toEqual({
      type: 'object',
      properties: { x: { type: 'string' } },
    });
  }
});

test('parseToolList defaults missing inputSchema and leaves empty description unmarked', () => {
  const result = parseToolList([{ name: 't1' }]);
  expect(result).toEqual({
    ok: true,
    tools: [{ name: 't1', description: '', inputSchema: { type: 'object' } }],
  });
});

test('parseToolList drops tools whose names break the MCP grammar', () => {
  const result = parseToolList([
    { name: 'good_tool-1' },
    { name: 'tool with spaces' },
    { name: '../../etc/passwd' },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.tools.map((t) => t.name)).toEqual(['good_tool-1']);
  }
});

test('parseToolList dedupes repeated names, keeping the first', () => {
  const result = parseToolList([
    { name: 'dup', description: 'first' },
    { name: 'dup', description: 'second' },
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].description.endsWith('first')).toBe(true);
  }
});

test('parseToolList strips control characters from descriptions', () => {
  const esc = String.fromCharCode(27);
  const bel = String.fromCharCode(7);
  const nul = String.fromCharCode(0);
  const dirty = `line1${esc}[31m\nline2${bel}${nul} end`;
  const result = parseToolList([{ name: 'ctl', description: dirty }]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    const d = result.tools[0].description;
    expect(d).not.toContain(esc);
    expect(d).not.toContain(bel);
    expect(d).not.toContain(nul);
    expect(d).not.toContain('\n');
  }
});

test('parseToolList rejects non-array', () => {
  const result = parseToolList({ tools: [] });
  expect(result.ok).toBe(false);
});

test('parseToolList rejects more than 128 entries', () => {
  const entries = Array.from({ length: 129 }, (_, i) => ({ name: `t${i}` }));
  const result = parseToolList(entries);
  expect(result.ok).toBe(false);
});

test('parseToolList rejects entry with non-string name', () => {
  const result = parseToolList([{ name: 1, description: 'd' }]);
  expect(result.ok).toBe(false);
});

test('parseToolCallResult passes content through verbatim', () => {
  const nested = { keep: true, arr: [1, { z: 2 }] };
  const content = [{ type: 'text', text: 'hi', nested }];
  const result = parseToolCallResult({ content, extra: 'drop-me' });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.content).toEqual(content);
    expect(result.value.content[0]).toEqual(content[0]);
    expect((result.value.content[0] as { nested: unknown }).nested).toEqual(nested);
  }
});

test('parseToolCallResult rejects missing content', () => {
  const result = parseToolCallResult({ isError: false });
  expect(result.ok).toBe(false);
});

test('parseToolCallResult rejects content that is not an array', () => {
  const result = parseToolCallResult({ content: { text: 'nope' } });
  expect(result.ok).toBe(false);
});

test('parseToolCallResult preserves isError boolean', () => {
  const result = parseToolCallResult({ content: [], isError: true });
  expect(result).toEqual({ ok: true, value: { content: [], isError: true } });
});
