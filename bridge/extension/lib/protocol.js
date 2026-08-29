import { MAX_WS_MESSAGE_BYTES } from './config.js';

const MAX_ERROR_CHARS = 10_000;
const MAX_ID_CHARS = 128;
const MAX_TOOL_LIST = 128;
const MAX_TOOL_NAME_CHARS = 128;
const MAX_TOOL_DESCRIPTION_CHARS = 4096;
const MAX_TOOL_CALL_CONTENT_ITEMS = 1000;
const MAX_HANDSHAKE_HEX_CHARS = 256;

function fail(error) {
  return { ok: false, error };
}

function isHex(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_HANDSHAKE_HEX_CHARS &&
    /^[0-9a-fA-F]+$/.test(value)
  );
}

// Random 128-bit nonce as hex. Uses crypto.getRandomValues, present in the
// service worker and in Bun test runs.
export function genNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// HMAC-SHA256(key, message) as lowercase hex — identical derivation to the
// server's token.ts hmacHex, so the two sides' proofs match.
export async function hmacHex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  let out = '';
  for (const b of new Uint8Array(sig)) out += b.toString(16).padStart(2, '0');
  return out;
}

// Length-safe hex compare. Not defending against a local timing side channel
// (the attacker would already be on loopback); this only avoids leaking via an
// early-return length check masquerading as constant work.
export function hexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i += 1) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8ByteLength(raw) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(raw).byteLength;
  }
  return raw.length;
}

function clonePlainObject(obj) {
  // Rebuild rather than spreading: untrusted page JSON must not carry
  // __proto__ / constructor into our objects.
  const out = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = obj[key];
  }
  return out;
}

function coerceError(value) {
  if (value instanceof Error) return value.message;
  return String(value);
}

/**
 * Validate a server → extension WS frame. Rebuilds with only known fields —
 * treat everything as data, never execute.
 */
export function validateServerMessage(raw) {
  if (typeof raw !== 'string') return fail('not a string');
  if (utf8ByteLength(raw) > MAX_WS_MESSAGE_BYTES) return fail('message too large');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('invalid JSON');
  }
  if (!isPlainObject(parsed)) return fail('not an object');

  const type = parsed.type;
  if (typeof type !== 'string' || type.length === 0) return fail('missing type');

  switch (type) {
    case 'hello_ack':
      return { ok: true, msg: { type: 'hello_ack' } };
    case 'hello_challenge': {
      if (!isHex(parsed.serverNonce)) return fail('serverNonce must be hex');
      if (!isHex(parsed.serverProof)) return fail('serverProof must be hex');
      return {
        ok: true,
        msg: { type: 'hello_challenge', serverNonce: parsed.serverNonce, serverProof: parsed.serverProof },
      };
    }
    case 'ping':
      return { ok: true, msg: { type: 'ping' } };
    case 'error': {
      if (typeof parsed.message !== 'string') return fail('error.message must be a string');
      if (parsed.message.length > MAX_ERROR_CHARS) return fail('error.message too long');
      return { ok: true, msg: { type: 'error', message: parsed.message } };
    }
    case 'request': {
      const id = parsed.id;
      if (typeof id !== 'string' || id.length === 0) {
        return fail('request.id must be a non-empty string');
      }
      if (id.length > MAX_ID_CHARS) return fail('request.id too long');
      const op = parsed.op;
      if (op === 'listTools') {
        return { ok: true, msg: { type: 'request', id, op: 'listTools' } };
      }
      if (op === 'callTool') {
        const name = parsed.name;
        if (typeof name !== 'string' || name.length === 0) {
          return fail('request.name must be a non-empty string');
        }
        if (name.length > MAX_TOOL_NAME_CHARS) return fail('request.name too long');
        if (parsed.args === undefined) {
          return { ok: true, msg: { type: 'request', id, op: 'callTool', name, args: {} } };
        }
        if (!isPlainObject(parsed.args)) return fail('request.args must be a plain object');
        return {
          ok: true,
          msg: { type: 'request', id, op: 'callTool', name, args: clonePlainObject(parsed.args) },
        };
      }
      return fail('unknown op');
    }
    default:
      return fail('unknown type');
  }
}

export function makeHello(clientNonce) {
  return { type: 'hello', clientNonce, extensionVersion: '0.1.0' };
}

export function makeHelloResponse(clientProof) {
  return { type: 'hello_response', clientProof };
}

export function makePaired(token, tabId, url) {
  return { type: 'paired', token, tab: { id: tabId, url } };
}

export function makeDisarmed(token) {
  return { type: 'disarmed', token };
}

export function makeToolsChanged(token) {
  return { type: 'tools_changed', token };
}

export function makeResponse(token, id, ok, resultOrError) {
  const msg = { type: 'response', token, id, ok: Boolean(ok) };
  if (msg.ok) {
    msg.result = resultOrError;
    return msg;
  }
  let error = coerceError(resultOrError);
  if (error.length > MAX_ERROR_CHARS) error = error.slice(0, MAX_ERROR_CHARS);
  msg.error = error;
  return msg;
}

export function validatePageResult(op, result) {
  if (op === 'listTools') {
    if (!Array.isArray(result)) return fail('tool list must be an array');
    if (result.length > MAX_TOOL_LIST) return fail('tool list too large');
    const tools = [];
    for (const entry of result) {
      if (!isPlainObject(entry)) return fail('tool entry must be an object');
      const name = entry.name;
      if (typeof name !== 'string' || name.length === 0) {
        return fail('tool name must be a non-empty string');
      }
      if (name.length > MAX_TOOL_NAME_CHARS) return fail('tool name too long');
      const description =
        typeof entry.description === 'string'
          ? entry.description.slice(0, MAX_TOOL_DESCRIPTION_CHARS)
          : '';
      const inputSchema = isPlainObject(entry.inputSchema)
        ? clonePlainObject(entry.inputSchema)
        : { type: 'object' };
      tools.push({ name, description, inputSchema });
    }
    return { ok: true, result: tools };
  }
  if (op === 'callTool') {
    if (!isPlainObject(result)) return fail('tool result must be an object');
    const content = result.content;
    if (!Array.isArray(content)) return fail('content must be an array');
    if (content.length > MAX_TOOL_CALL_CONTENT_ITEMS) return fail('content too large');
    // Pass content through as data — never execute, never transform.
    const value = { content };
    if (typeof result.isError === 'boolean') value.isError = result.isError;
    return { ok: true, result: value };
  }
  return fail('unknown op');
}
