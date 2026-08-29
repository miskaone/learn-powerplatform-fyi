export const MAX_WS_MESSAGE_BYTES = 1_000_000;
export const MAX_TOKEN_LENGTH = 256;

const MAX_TAB_URL_CHARS = 4096;
const MAX_RESPONSE_ID_CHARS = 128;
const MAX_ERROR_CHARS = 10_000;
const MAX_TOOL_LIST = 128;
const MAX_TOOL_NAME_CHARS = 128;
const MAX_TOOL_DESCRIPTION_CHARS = 4096;
const MAX_TOOL_CALL_CONTENT_ITEMS = 1000;

export type HelloMessage = {
  type: 'hello';
  token: string;
  extensionVersion?: string;
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
  | PairedMessage
  | DisarmedMessage
  | ToolsChangedMessage
  | ResponseMessage;

export type HelloAckMessage = { type: 'hello_ack' };
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

  const tokenParsed = parseToken(parsed.token);
  if (!tokenParsed.ok) return tokenParsed;
  const token = tokenParsed.token;

  switch (type) {
    case 'hello': {
      const msg: HelloMessage = { type: 'hello', token };
      if (typeof parsed.extensionVersion === 'string') {
        msg.extensionVersion = parsed.extensionVersion;
      }
      return { ok: true, msg };
    }
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

export function parseToolList(
  result: unknown,
): { ok: true; tools: WebMcpToolDescriptor[] } | { ok: false; error: string } {
  if (!Array.isArray(result)) return fail('tool list must be an array');
  if (result.length > MAX_TOOL_LIST) return fail('tool list too large');

  const tools: WebMcpToolDescriptor[] = [];
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
