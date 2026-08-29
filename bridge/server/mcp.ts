const KNOWN_PROTOCOL_VERSIONS = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export function createLineSplitter(): (chunk: string) => string[] {
  let buffer = '';
  return (chunk: string): string[] => {
    buffer += chunk;
    const lines: string[] = [];
    let idx = buffer.indexOf('\n');
    while (idx !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.trim() === '') {
        idx = buffer.indexOf('\n');
        continue;
      }
      lines.push(line);
      idx = buffer.indexOf('\n');
    }
    return lines;
  };
}

export interface McpBackend {
  listTools(): Promise<{
    tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  }>;
  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: unknown[]; isError?: boolean }>;
}

type JsonRpcId = string | number | null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readableId(value: unknown): JsonRpcId {
  if (!isPlainObject(value)) return null;
  if (!('id' in value)) return null;
  const id = value.id;
  if (id === null || typeof id === 'string' || typeof id === 'number') return id;
  return null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function rpcError(id: JsonRpcId, code: number, message: string): object {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function rpcResult(id: JsonRpcId, result: unknown): object {
  return { jsonrpc: '2.0', id, result };
}

export function createMcpCore(
  backend: McpBackend,
  opts: { serverName: string; serverVersion: string; log: (msg: string) => void },
): {
  handleLine(line: string): Promise<object | null>;
  makeToolListChangedNotification(): object;
} {
  let initialized = false;

  async function handleLine(line: string): Promise<object | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return rpcError(null, -32700, 'Parse error');
    }

    if (!isPlainObject(parsed) || parsed.jsonrpc !== '2.0') {
      return rpcError(readableId(parsed), -32600, 'Invalid Request');
    }

    const method = parsed.method;
    if (typeof method !== 'string') {
      return rpcError(readableId(parsed), -32600, 'Invalid Request');
    }

    const hasId = 'id' in parsed;
    const id = readableId(parsed);

    if (method.startsWith('notifications/')) {
      if (method !== 'notifications/initialized' && method !== 'notifications/cancelled') {
        opts.log(`unknown notification: ${method}`);
      }
      return null;
    }

    if (!hasId) {
      opts.log(`notification-style message for method ${method}`);
      return null;
    }

    if (!initialized && method !== 'initialize') {
      opts.log(`request ${method} received before initialize`);
    }

    switch (method) {
      case 'initialize': {
        initialized = true;
        let protocolVersion = DEFAULT_PROTOCOL_VERSION;
        if (isPlainObject(parsed.params) && typeof parsed.params.protocolVersion === 'string') {
          if (KNOWN_PROTOCOL_VERSIONS.has(parsed.params.protocolVersion)) {
            protocolVersion = parsed.params.protocolVersion;
          }
        }
        return rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: opts.serverName, version: opts.serverVersion },
        });
      }
      case 'ping':
        return rpcResult(id, {});
      case 'tools/list': {
        try {
          const listed = await backend.listTools();
          return rpcResult(id, listed);
        } catch (err) {
          return rpcError(id, -32603, errorMessage(err));
        }
      }
      case 'tools/call': {
        const params = parsed.params;
        if (!isPlainObject(params) || typeof params.name !== 'string') {
          return rpcError(id, -32602, 'Invalid params');
        }
        let args: Record<string, unknown> = {};
        if ('arguments' in params) {
          if (!isPlainObject(params.arguments)) {
            return rpcError(id, -32602, 'Invalid params');
          }
          args = params.arguments;
        }
        try {
          const result = await backend.callTool(params.name, args);
          return rpcResult(id, result);
        } catch (err) {
          // Tool-level failure is an isError RESULT per MCP spec, not a protocol error.
          return rpcResult(id, {
            content: [{ type: 'text', text: 'Bridge error: ' + errorMessage(err) }],
            isError: true,
          });
        }
      }
      default:
        return rpcError(id, -32601, 'Method not found');
    }
  }

  function makeToolListChangedNotification(): object {
    return { jsonrpc: '2.0', method: 'notifications/tools/list_changed' };
  }

  return { handleLine, makeToolListChangedNotification };
}
