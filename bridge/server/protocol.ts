export const MAX_WS_MESSAGE_BYTES = 1_000_000;
export const MAX_TOKEN_LENGTH = 256;

const MAX_TAB_URL_CHARS = 4096;
const MAX_RESPONSE_ID_CHARS = 128;
const MAX_ERROR_CHARS = 10_000;
const MAX_TOOL_LIST = 128;
const MAX_TOOL_NAME_CHARS = 128;
const MAX_TOOL_DESCRIPTION_CHARS = 4096;
const MAX_TOOL_CALL_CONTENT_ITEMS = 1000;
const MAX_HANDSHAKE_HEX_CHARS = 256;

// MCP tool-name grammar: names crossing to the MCP client must match this or
// a schema-validating client rejects the whole tools/list. Enforced in
// parseToolList; non-conforming tools are dropped, not passed through.
const MCP_TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,128}$/;
// Marks the start of untrusted, page-authored description text so a
// same-origin script cannot smuggle instructions into the agent's context as
// if they came from the bridge.
const UNTRUSTED_DESCRIPTION_PREFIX = '[untrusted page-provided description] ';

export type HelloMessage = {
  type: 'hello';
  clientNonce: string;
  extensionVersion?: string;
};

export type HelloResponseMessage = {
  type: 'hello_response';
  clientProof: string;
};

export type PairedMessage = {
  type: 'paired';
  token: string;
  tab: { id: number; url: string };
};

export type DisarmedMessage = {
  type: 'disarmed';
  token: string;
};

export type ToolsChangedMessage = {
  type: 'tools_changed';
  token: string;
};

export type ResponseMessage = {
  type: 'response';
  token: string;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type ExtToServerMessage =
  | HelloMessage
  | HelloResponseMessage
  | PairedMessage
  | DisarmedMessage
  | ToolsChangedMessage
  | ResponseMessage;

export type HelloAckMessage = { type: 'hello_ack' };
export type HelloChallengeMessage = {
  type: 'hello_challenge';
  serverNonce: string;
  serverProof: string;
};
export type PingMessage = { type: 'ping' };
export type ErrorMessage = { type: 'error'; message: string };
export type ListToolsRequest = { type: 'request'; id: string; op: 'listTools' };
export type CallToolRequest = {
  type: 'request';
  id: string;
  op: 'callTool';
  name: string;
  args: unknown;
};

export type ServerToExtMessage =
  | HelloAckMessage
  | HelloChallengeMessage
  | PingMessage
  | ErrorMessage
  | ListToolsRequest
  | CallToolRequest;

export interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function utf8ByteLength(raw: string | Buffer): number {
  return typeof raw === 'string' ? Buffer.byteLength(raw, 'utf8') : raw.byteLength;
}

function asText(raw: string | Buffer): string {
  return typeof raw === 'string' ? raw : raw.toString('utf8');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseToken(value: unknown): { ok: true; token: string } | { ok: false; error: string } {
  if (value === undefined) return { ok: false, error: 'token missing' };
  if (typeof value !== 'string') return { ok: false, error: 'token must be a string' };
  if (value.length === 0) return { ok: false, error: 'token is empty' };
  if (value.length > MAX_TOKEN_LENGTH) return { ok: false, error: 'token too long' };
  return { ok: true, token: value };
}

function parseHex(
  value: unknown,
  label: string,
): { ok: true; hex: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: `${label} must be a string` };
  if (value.length === 0) return { ok: false, error: `${label} is empty` };
  if (value.length > MAX_HANDSHAKE_HEX_CHARS) return { ok: false, error: `${label} too long` };
  if (!/^[0-9a-fA-F]+$/.test(value)) return { ok: false, error: `${label} must be hex` };
  return { ok: true, hex: value };
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export function parseExtMessage(
  raw: string | Buffer,
): { ok: true; msg: ExtToServerMessage } | { ok: false; error: string } {
  if (utf8ByteLength(raw) > MAX_WS_MESSAGE_BYTES) {
    return fail('message too large');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(asText(raw));
  } catch {
    return fail('invalid JSON');
  }

  if (!isPlainObject(parsed)) {
    return fail('not an object');
  }

  const type = parsed.type;
  if (typeof type !== 'string' || type.length === 0) {
    return fail('missing type');
  }

  // The handshake frames (hello / hello_response) carry no token: proving
  // possession over the wire is what the challenge-response replaces. Every
  // post-handshake frame still carries the token and is checked below.
  if (type === 'hello') {
    const nonce = parseHex(parsed.clientNonce, 'clientNonce');
    if (!nonce.ok) return nonce;
    const msg: HelloMessage = { type: 'hello', clientNonce: nonce.hex };
    if (typeof parsed.extensionVersion === 'string') {
      msg.extensionVersion = parsed.extensionVersion;
    }
    return { ok: true, msg };
  }
  if (type === 'hello_response') {
    const proof = parseHex(parsed.clientProof, 'clientProof');
    if (!proof.ok) return proof;
    return { ok: true, msg: { type: 'hello_response', clientProof: proof.hex } };
  }

  const tokenParsed = parseToken(parsed.token);
  if (!tokenParsed.ok) return tokenParsed;
  const token = tokenParsed.token;

  switch (type) {
    case 'paired': {
      if (!isPlainObject(parsed.tab)) return fail('tab must be an object');
      const id = parsed.tab.id;
      const url = parsed.tab.url;
      if (typeof id !== 'number' || !Number.isFinite(id)) {
        return fail('tab.id must be a finite number');
      }
      if (typeof url !== 'string') return fail('tab.url must be a string');
      if (url.length > MAX_TAB_URL_CHARS) return fail('tab.url too long');
      const msg: PairedMessage = { type: 'paired', token, tab: { id, url } };
      return { ok: true, msg };
    }
    case 'disarmed': {
      const msg: DisarmedMessage = { type: 'disarmed', token };
      return { ok: true, msg };
    }
    case 'tools_changed': {
      const msg: ToolsChangedMessage = { type: 'tools_changed', token };
      return { ok: true, msg };
    }
    case 'response': {
      const id = parsed.id;
      if (typeof id !== 'string' || id.length === 0) {
        return fail('response.id must be a non-empty string');
      }
      if (id.length > MAX_RESPONSE_ID_CHARS) return fail('response.id too long');
      if (typeof parsed.ok !== 'boolean') return fail('response.ok must be a boolean');
      const msg: ResponseMessage = { type: 'response', token, id, ok: parsed.ok };
      if ('result' in parsed) msg.result = parsed.result;
      if ('error' in parsed) {
        if (typeof parsed.error !== 'string') return fail('response.error must be a string');
        if (parsed.error.length > MAX_ERROR_CHARS) return fail('response.error too long');
        msg.error = parsed.error;
      }
      return { ok: true, msg };
    }
    default:
      return fail('unknown type');
  }
}

function clonePlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  // Rebuild rather than spreading: untrusted browser JSON must not
  // carry __proto__ / constructor into our objects.
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = obj[key];
  }
  return out;
}

// Strip C0 control characters (except none — names may not contain them, and
// descriptions must not carry ANSI escapes or stray newlines that reframe the
// agent's context). Keeps ordinary printable text intact.
// eslint-disable-next-line no-control-regex
const C0_CONTROL_RE = /[\u0000-\u001F\u007F]/g;

export function parseToolList(
  result: unknown,
): { ok: true; tools: WebMcpToolDescriptor[] } | { ok: false; error: string } {
  if (!Array.isArray(result)) return fail('tool list must be an array');
  if (result.length > MAX_TOOL_LIST) return fail('tool list too large');

  const tools: WebMcpToolDescriptor[] = [];
  const seen = new Set<string>();
  for (const entry of result) {
    if (!isPlainObject(entry)) return fail('tool entry must be an object');
    const name = entry.name;
    if (typeof name !== 'string' || name.length === 0) {
      return fail('tool name must be a non-empty string');
    }
    if (name.length > MAX_TOOL_NAME_CHARS) return fail('tool name too long');
    // Drop — never reject the whole list for — a page tool whose name breaks
    // the MCP grammar or duplicates one already accepted. One malformed tool
    // must not vanish every tool for a schema-validating client.
    if (!MCP_TOOL_NAME_RE.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const rawDescription =
      typeof entry.description === 'string'
        ? entry.description.replace(C0_CONTROL_RE, ' ').slice(0, MAX_TOOL_DESCRIPTION_CHARS)
        : '';
    const description =
      rawDescription.length > 0 ? UNTRUSTED_DESCRIPTION_PREFIX + rawDescription : '';
    const inputSchema =
      isPlainObject(entry.inputSchema) ? clonePlainObject(entry.inputSchema) : { type: 'object' };
    tools.push({ name, description, inputSchema });
  }
  return { ok: true, tools };
}

export function parseToolCallResult(
  result: unknown,
): { ok: true; value: { content: unknown[]; isError?: boolean } } | { ok: false; error: string } {
  if (!isPlainObject(result)) return fail('tool result must be an object');
  const content = result.content;
  if (!Array.isArray(content)) return fail('content must be an array');
  if (content.length > MAX_TOOL_CALL_CONTENT_ITEMS) return fail('content too large');
  // Pass content through as data — never execute, never transform.
  const value: { content: unknown[]; isError?: boolean } = { content };
  if (typeof result.isError === 'boolean') value.isError = result.isError;
  return { ok: true, value };
}
