import { expect, test } from 'bun:test';
import { MAX_WS_MESSAGE_BYTES } from './config.js';
import {
  makeResponse,
  validatePageResult,
  validateServerMessage,
} from './protocol.js';

test('validateServerMessage accepts hello_ack', () => {
  const result = validateServerMessage(JSON.stringify({ type: 'hello_ack' }));
  expect(result).toEqual({ ok: true, msg: { type: 'hello_ack' } });
});

test('validateServerMessage accepts request listTools', () => {
  const result = validateServerMessage(
    JSON.stringify({ type: 'request', id: '1', op: 'listTools' }),
  );
  expect(result).toEqual({
    ok: true,
    msg: { type: 'request', id: '1', op: 'listTools' },
  });
});

test('validateServerMessage callTool without args defaults args to {}', () => {
  const result = validateServerMessage(
    JSON.stringify({ type: 'request', id: '2', op: 'callTool', name: 't1' }),
  );
  expect(result).toEqual({
    ok: true,
    msg: { type: 'request', id: '2', op: 'callTool', name: 't1', args: {} },
  });
});

test('validateServerMessage rejects callTool with non-object args', () => {
  const result = validateServerMessage(
    JSON.stringify({
      type: 'request',
      id: '2',
      op: 'callTool',
      name: 't1',
      args: ['not', 'an', 'object'],
    }),
  );
  expect(result.ok).toBe(false);
});

test('validateServerMessage rejects unknown type', () => {
  const result = validateServerMessage(JSON.stringify({ type: 'nope' }));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('unknown type');
});

test('validateServerMessage rejects oversize messages', () => {
  const result = validateServerMessage('x'.repeat(MAX_WS_MESSAGE_BYTES + 1));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('message too large');
});

test('validateServerMessage rejects non-JSON', () => {
  const result = validateServerMessage('not-json');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('invalid JSON');
});

test('validateServerMessage strips extra fields', () => {
  const result = validateServerMessage(
    JSON.stringify({ type: 'hello_ack', extra: 1, foo: 'bar' }),
  );
  expect(result).toEqual({ ok: true, msg: { type: 'hello_ack' } });
});

test('makeResponse ok:true carries result', () => {
  expect(makeResponse('tok', '1', true, { hello: 'world' })).toEqual({
    type: 'response',
    token: 'tok',
    id: '1',
    ok: true,
    result: { hello: 'world' },
  });
});

test('makeResponse ok:false coerces Error to string message and truncates', () => {
  const coerced = makeResponse('tok', '1', false, new Error('boom'));
  expect(coerced).toEqual({
    type: 'response',
    token: 'tok',
    id: '1',
    ok: false,
    error: 'boom',
  });
  const long = 'x'.repeat(12_000);
  const truncated = makeResponse('tok', '1', false, long);
  expect(truncated.error).toHaveLength(10_000);
  expect(truncated.error).toBe(long.slice(0, 10_000));
});

test('validatePageResult listTools applies defaults', () => {
  const result = validatePageResult('listTools', [{ name: 't1' }]);
  expect(result).toEqual({
    ok: true,
    result: [{ name: 't1', description: '', inputSchema: { type: 'object' } }],
  });
});

test('validatePageResult callTool content is verbatim', () => {
  const nested = { keep: true, arr: [1, { z: 2 }] };
  const content = [{ type: 'text', text: 'hi', nested }];
  const result = validatePageResult('callTool', { content, extra: 'drop-me' });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.result.content).toEqual(content);
    expect(result.result.content[0]).toEqual(content[0]);
    expect(result.result.content[0].nested).toEqual(nested);
    expect(result.result.content[0].nested).toBe(nested);
  }
});

test('validatePageResult callTool rejects missing content', () => {
  const result = validatePageResult('callTool', { isError: false });
  expect(result.ok).toBe(false);
});
