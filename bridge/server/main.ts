import { createBridgeBackend } from './backend';
import { createLineSplitter, createMcpCore } from './mcp';
import { generateToken } from './token';
import { BridgeWsServer } from './ws';

const DEFAULT_PORT = 8765;

const USAGE = `Usage: bun bridge/server/main.ts [--port N] [--help]

A local MCP stdio server that proxies WebMCP tools from one paired browser
tab. A Chrome MV3 extension connects to this process over a localhost
WebSocket; stdout is the MCP JSON-RPC transport (one message per line).
Logs and the pairing token are written to stderr so they never mix into
the JSON-RPC stream.

Options:
  --port N    WebSocket listen port (default ${DEFAULT_PORT}, or WEBMCP_BRIDGE_PORT)
  --help      Show this help and exit

Pairing:
  On start, a pairing token is printed to stderr. Paste it into the
  WebMCP Bridge extension popup, then arm a tab on
  https://learn.powerplatform.fyi.

MCP client config examples: see bridge/README.md
`;

function log(msg: string): void {
  process.stderr.write('[webmcp-bridge] ' + msg + '\n');
}

function parseArgs(argv: string[]): { help: true } | { help: false; port: number } {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };

  let port = DEFAULT_PORT;
  const env = process.env.WEBMCP_BRIDGE_PORT;
  if (env !== undefined && env !== '') {
    const n = Number(env);
    if (Number.isFinite(n) && n >= 0) port = Math.trunc(n);
  }
  const flag = argv.indexOf('--port');
  if (flag !== -1) {
    const n = Number(argv[flag + 1]);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('invalid --port (expected a non-negative number)');
    }
    port = Math.trunc(n);
  }
  return { help: false, port };
}

function isPortInUse(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    if (rec.code === 'EADDRINUSE') return true;
    if (rec.errno === 48 || rec.errno === -48 || rec.errno === -98) return true;
    if (typeof rec.message === 'string' && /in use/i.test(rec.message)) return true;
  }
  if (err instanceof Error && /in use/i.test(err.message)) return true;
  return false;
}

function writeStdout(obj: object): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let parsed: { help: true } | { help: false; port: number };
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  if (parsed.help) {
    process.stdout.write(USAGE);
    process.exit(0);
    return;
  }

  const token = generateToken();
  const ws = new BridgeWsServer({ port: parsed.port, token, log });
  try {
    ws.start();
  } catch (err) {
    if (isPortInUse(err)) {
      log(`Port ${parsed.port} is already in use. Stop the other process or pass --port N.`);
      process.exit(1);
      return;
    }
    throw err;
  }

  log(`WebSocket listening on ws://127.0.0.1:${ws.port}`);
  // Token on stderr, never stdout: stdout is the MCP JSON-RPC transport.
  log(`Pairing token: ${token}`);
  log('Paste this token into the WebMCP Bridge extension popup, then arm a tab.');

  const backend = createBridgeBackend(ws, log);
  const core = createMcpCore(backend, {
    serverName: 'webmcp-bridge',
    serverVersion: '0.1.0',
    log,
  });

  // list_changed handling. Three properties enforced here:
  //   (finding 9) never emit before the client's initialize response has been
  //     written — hold notifications until `ready`;
  //   (finding 7) coalesce bursts: the page can fire toolchange in a loop, but
  //     every notification is identical, so collapse to at most one per window;
  //   the payload is constant, so a pending flag is all the buffer we need.
  const LIST_CHANGED_MIN_INTERVAL_MS = 250;
  let ready = false;
  let listChangedPending = false;
  let listChangedCooling = false;

  const flushListChanged = (): void => {
    if (!ready || !listChangedPending) return;
    if (listChangedCooling) return;
    listChangedPending = false;
    listChangedCooling = true;
    writeStdout(core.makeToolListChangedNotification());
    setTimeout(() => {
      listChangedCooling = false;
      flushListChanged();
    }, LIST_CHANGED_MIN_INTERVAL_MS).unref?.();
  };

  const notifyToolsChanged = (): void => {
    listChangedPending = true;
    flushListChanged();
  };
  ws.onToolsChanged(notifyToolsChanged);
  ws.onPairingChanged(notifyToolsChanged);

  // Dispatch each JSON-RPC line without awaiting the previous one (finding 8):
  // a slow tools/call must not head-of-line block ping or cancellation. Writes
  // stay ordered because writeStdout is synchronous and each completion writes
  // in microtask order.
  const dispatch = (line: string): void => {
    void core.handleLine(line).then(
      (resp) => {
        if (resp !== null) writeStdout(resp);
        if (!ready && core.isInitialized()) {
          ready = true;
          flushListChanged();
        }
      },
      (err: unknown) => {
        log(`handleLine error: ${err instanceof Error ? err.message : String(err)}`);
      },
    );
  };

  const splitter = createLineSplitter();
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    const text = decoder.decode(chunk, { stream: true });
    for (const line of splitter(text)) {
      dispatch(line);
    }
  }

  ws.stop();
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    log(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
