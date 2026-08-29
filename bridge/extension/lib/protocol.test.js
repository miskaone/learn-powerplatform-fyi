import { expect, test } from 'bun:test';
import { MAX_WS_MESSAGE_BYTES } from './config.js';
import {
  genNonce,
  hexEqual,
  hmacHex,
  makeHello,
  makeHelloResponse,
  makeResponse,
  validatePageResult,
  validateServerMessage,
} from './protocol.js';
// The server derives its proofs with the same primitive; import it to prove
// the two implementations agree byte for byte.
import { hmacHex as serverHmacHex } from '../../server/token.ts';

test('validateServerMessage accepts hello_ack', () => {
  const result = validateServerMessage(JSON.stringify({ type: 'hello_ack' }));
  expect(result).toEqual({ ok: true, msg: { type: 'hello_ack' } });
});

test('validateServerMessage accepts hello_challenge with hex fields', () => {
  const result = validateServerMessage(
    JSON.stringify({ type: 'hello_challenge', serverNonce: 'ab12', serverProof: 'deadbeef' }),
  );
  expect(result).toEqual({
    ok: true,
    msg: { type: 'hello_challenge', serverNonce: 'ab12', serverProof: 'deadbeef' },
  });
});

test('validateServerMessage rejects hello_challenge with non-hex fields', () => {
  const result = validateServerMessage(
    JSON.stringify({ type: 'hello_challenge', serverNonce: 'zz', serverProof: 'nope!' }),
  );
  expect(result.ok).toBe(false);
});

test('validateServerMessage accepts ping', () => {
  const result = validateServerMessage(JSON.stringify({ type: 'ping' }));
  expect(result).toEqual({ ok: true, msg: { type: 'ping' } });
});

test('makeHello carries a nonce and never a token', () => {
  const msg = makeHello('ab12');
  expect(msg.type).toBe('hello');
  expect(msg.clientNonce).toBe('ab12');
  expect('token' in msg).toBe(false);
});

test('makeHelloResponse carries only the proof', () => {
  expect(makeHelloResponse('deadbeef')).toEqual({ type: 'hello_response', clientProof: 'deadbeef' });
});

test('genNonce returns 32 hex chars', () => {
  const n = genNonce();
  expect(n).toMatch(/^[0-9a-f]{32}$/);
  expect(genNonce()).not.toBe(n);
});

test('hexEqual is length- and content-sensitive', () => {
  expect(hexEqual('abcd', 'abcd')).toBe(true);
  expect(hexEqual('abcd', 'abce')).toBe(false);
  expect(hexEqual('abcd', 'abc')).toBe(false);
  expect(hexEqual('abcd', 123)).toBe(false);
});

test('extension hmacHex matches the server hmacHex byte for byte', async () => {
  const token = 'a'.repeat(64);
  const nonce = genNonce();
  const ext = await hmacHex(token, `server|${nonce}`);
  const srv = await serverHmacHex(token, `server|${nonce}`);
  expect(ext).toBe(srv);
  expect(ext).toMatch(/^[0-9a-f]{64}$/);
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
