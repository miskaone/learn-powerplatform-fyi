import type { Server, ServerWebSocket } from 'bun';
import {
  MAX_WS_MESSAGE_BYTES,
  parseExtMessage,
  parseToolCallResult,
  parseToolList,
  type ServerToExtMessage,
  type WebMcpToolDescriptor,
} from './protocol';
import { tokenMatches } from './token';

type SocketData = {
  authenticated: boolean;
  authTimer: ReturnType<typeof setTimeout> | null;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const AUTH_TIMEOUT_MS = 5000;

export class BridgeWsServer {
  private readonly listenPort: number;
  private readonly token: string;
  private readonly log: (msg: string) => void;
  private readonly requestTimeoutMs: number;
  private server: Server<SocketData> | null = null;
  private authWs: ServerWebSocket<SocketData> | null = null;
  private pairedTab: { id: number; url: string } | null = null;
  private readonly pending = new Map<string, Pending>();
  private nextRequestId = 1;
  private readonly sockets = new Set<ServerWebSocket<SocketData>>();
  private readonly toolsChangedCbs: Array<() => void> = [];
  private readonly pairingChangedCbs: Array<() => void> = [];
  private stopped = false;

  constructor(opts: {
    port: number;
    token: string;
    log: (msg: string) => void;
    requestTimeoutMs?: number;
  }) {
    this.listenPort = opts.port;
    this.token = opts.token;
    this.log = opts.log;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 15_000;
  }

  start(): void {
    if (this.server) return;
    this.stopped = false;
    const self = this;
    this.server = Bun.serve<SocketData>({
      // Bind loopback only: the pairing token is a bearer secret. Listening on
      // 0.0.0.0 would expose that handshake to the LAN.
      hostname: '127.0.0.1',
      port: this.listenPort,
      fetch(req, server) {
        const upgraded = server.upgrade(req, {
          data: { authenticated: false, authTimer: null },
        });
        if (!upgraded) {
          return new Response('Expected WebSocket', { status: 400 });
        }
        return undefined;
      },
      websocket: {
        maxPayloadLength: MAX_WS_MESSAGE_BYTES + 65_536,
        open(ws) {
          self.sockets.add(ws);
          ws.data.authTimer = setTimeout(() => {
            if (!ws.data.authenticated && !self.stopped) {
              self.log('unauthenticated socket timed out');
              try {
                ws.close(4001, 'auth failed');
              } catch {
                /* already closing */
              }
            }
          }, AUTH_TIMEOUT_MS);
        },
        message(ws, message) {
          self.onMessage(ws, message);
        },
        close(ws) {
          self.onClose(ws);
        },
      },
    });
  }

  get port(): number {
    if (!this.server) throw new Error('server not started');
    return this.server.port;
  }

  get isConnected(): boolean {
    return this.authWs !== null;
  }

  get isPaired(): boolean {
    return this.pairedTab !== null;
  }

  get pairedTabUrl(): string | null {
    return this.pairedTab?.url ?? null;
  }

  onToolsChanged(cb: () => void): void {
    this.toolsChangedCbs.push(cb);
  }

  onPairingChanged(cb: () => void): void {
    this.pairingChangedCbs.push(cb);
  }

  async listTools(): Promise<WebMcpToolDescriptor[]> {
    const result = await this.sendRequest({
      type: 'request',
      id: this.nextId(),
      op: 'listTools',
    });
    const parsed = parseToolList(result);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.tools;
  }

  async callTool(
    name: string,
    args: unknown,
  ): Promise<{ content: unknown[]; isError?: boolean }> {
    const result = await this.sendRequest({
      type: 'request',
      id: this.nextId(),
      op: 'callTool',
      name,
      args,
    });
    const parsed = parseToolCallResult(result);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
  }

  stop(): void {
    if (this.stopped && !this.server) return;
    this.stopped = true;
    this.rejectAllPending('server stopped');
    for (const ws of this.sockets) {
      this.clearAuthTimer(ws);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    }
    this.sockets.clear();
    this.authWs = null;
    this.pairedTab = null;
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
  }

  private nextId(): string {
    const id = String(this.nextRequestId);
    this.nextRequestId += 1;
    return id;
  }

  private fireToolsChanged(): void {
    for (const cb of this.toolsChangedCbs) {
      try {
        cb();
      } catch (err) {
        this.log(`onToolsChanged callback error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private firePairingChanged(): void {
    for (const cb of this.pairingChangedCbs) {
      try {
        cb();
      } catch (err) {
        this.log(
          `onPairingChanged callback error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private clearAuthTimer(ws: ServerWebSocket<SocketData>): void {
    if (ws.data.authTimer) {
      clearTimeout(ws.data.authTimer);
      ws.data.authTimer = null;
    }
  }

  private rejectAllPending(message: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }

  private sendJson(ws: ServerWebSocket<SocketData>, msg: ServerToExtMessage): void {
    ws.send(JSON.stringify(msg));
  }

  private failAuth(ws: ServerWebSocket<SocketData>, message: string): void {
    this.log(`auth failed: ${message}`);
    try {
      this.sendJson(ws, { type: 'error', message });
    } catch {
      /* ignore send failure */
    }
    try {
      ws.close(4001, 'auth failed');
    } catch {
      /* already closing */
    }
  }

  private onMessage(ws: ServerWebSocket<SocketData>, message: string | Buffer): void {
    const raw: string | Buffer = typeof message === 'string' ? message : Buffer.from(message);
    const parsed = parseExtMessage(raw);

    if (!ws.data.authenticated) {
      if (!parsed.ok) {
        this.failAuth(ws, parsed.error);
        return;
      }
      if (parsed.msg.type !== 'hello') {
        this.failAuth(ws, 'first message must be hello');
        return;
      }
      if (!tokenMatches(this.token, parsed.msg.token)) {
        this.failAuth(ws, 'invalid token');
        return;
      }
      this.clearAuthTimer(ws);
      const previous = this.authWs;
      this.authWs = ws;
      ws.data.authenticated = true;
      if (previous && previous !== ws) {
        this.log('replaced authenticated extension socket');
        if (this.pairedTab) {
          this.pairedTab = null;
          this.firePairingChanged();
        }
        this.rejectAllPending('extension disconnected');
        try {
          previous.close(4000, 'replaced');
        } catch {
          /* already closing */
        }
      }
      this.sendJson(ws, { type: 'hello_ack' });
      this.log('extension authenticated');
      return;
    }

    if (!parsed.ok) {
      this.log(`invalid message from extension: ${parsed.error}`);
      return;
    }

    if (!tokenMatches(this.token, parsed.msg.token)) {
      this.log('token mismatch on authenticated socket');
      try {
        this.sendJson(ws, { type: 'error', message: 'invalid token' });
      } catch {
        /* ignore */
      }
      try {
        ws.close(4001, 'auth failed');
      } catch {
        /* already closing */
      }
      return;
    }

    const msg = parsed.msg;
    switch (msg.type) {
      case 'paired':
        this.pairedTab = { id: msg.tab.id, url: msg.tab.url };
        this.firePairingChanged();
        break;
      case 'disarmed':
        this.pairedTab = null;
        this.firePairingChanged();
        break;
      case 'tools_changed':
        this.fireToolsChanged();
        break;
      case 'response': {
        const pending = this.pending.get(msg.id);
        if (!pending) {
          this.log(`unknown response id: ${msg.id}`);
          break;
        }
        this.pending.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.ok) {
          pending.resolve(msg.result);
        } else {
          pending.reject(new Error(msg.error ?? 'unknown extension error'));
        }
        break;
      }
      default:
        this.log(`ignored authenticated message type: ${msg.type}`);
    }
  }

  private onClose(ws: ServerWebSocket<SocketData>): void {
    this.clearAuthTimer(ws);
    this.sockets.delete(ws);
    if (this.authWs === ws) {
      this.authWs = null;
      this.pairedTab = null;
      this.rejectAllPending('extension disconnected');
      this.firePairingChanged();
      this.log('extension disconnected');
    }
  }

  private sendRequest(msg: ServerToExtMessage & { type: 'request' }): Promise<unknown> {
    if (!this.authWs) return Promise.reject(new Error('no extension connected'));
    if (!this.pairedTab) return Promise.reject(new Error('no tab paired'));
    const ws = this.authWs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msg.id);
        reject(new Error('extension request timed out'));
      }, this.requestTimeoutMs);
      this.pending.set(msg.id, { resolve, reject, timer });
      try {
        this.sendJson(ws, msg);
      } catch (err) {
        this.pending.delete(msg.id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
