import { afterEach, expect, test } from 'bun:test';
import { MAX_WS_MESSAGE_BYTES } from './protocol';
import { generateNonce, generateToken, hmacHex } from './token';
import { BridgeWsServer } from './ws';

const live: BridgeWsServer[] = [];

afterEach(() => {
  while (live.length > 0) {
    const server = live.pop();
    server?.stop();
  }
});

function startServer(opts?: {
  requestTimeoutMs?: number;
  token?: string;
  pingIntervalMs?: number;
}): {
  server: BridgeWsServer;
  token: string;
  port: number;
} {
  const token = opts?.token ?? generateToken();
  const server = new BridgeWsServer({
    port: 0,
    token,
    log: () => {},
    requestTimeoutMs: opts?.requestTimeoutMs,
    pingIntervalMs: opts?.pingIntervalMs,
  });
  server.start();
  live.push(server);
  return { server, token, port: server.port };
}

function openClient(port: number) {
  const ws = new globalThis.WebSocket(`ws://127.0.0.1:${port}`);
  const queue: unknown[] = [];
  const waiters: Array<(msg: unknown) => void> = [];
  let closeResult: { code: number; reason: string } | undefined;
  const closeWaiters: Array<(c: { code: number; reason: string }) => void> = [];

  ws.addEventListener('message', (ev) => {
    const text =
      typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
    const waiter = waiters.shift();
    if (waiter) waiter(parsed);
    else queue.push(parsed);
  });
  ws.addEventListener('close', (ev) => {
    closeResult = { code: ev.code, reason: String(ev.reason) };
    for (const waiter of closeWaiters) waiter(closeResult);
  });
  ws.addEventListener('error', () => {});

  return {
    ws,
    async waitOpen() {
      if (ws.readyState === WebSocket.OPEN) return;
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error('WebSocket error')), { once: true });
      });
    },
    nextMessage(): Promise<unknown> {
      if (queue.length > 0) return Promise.resolve(queue.shift());
      return new Promise((resolve) => waiters.push(resolve));
    },
    waitClose(): Promise<{ code: number; reason: string }> {
      if (closeResult) return Promise.resolve(closeResult);
      return new Promise((resolve) => closeWaiters.push(resolve));
    },
  };
}

async function waitUntil(pred: () => boolean, ms = 1000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('waitUntil timed out');
    await Bun.sleep(10);
  }
}

async function authClient(port: number, token: string) {
  const client = openClient(port);
  await client.waitOpen();
  const clientNonce = generateNonce();
  client.ws.send(JSON.stringify({ type: 'hello', clientNonce }));
  const challenge = (await client.nextMessage()) as {
    type: string;
    serverNonce: string;
    serverProof: string;
  };
  expect(challenge.type).toBe('hello_challenge');
  // The server must prove it holds the token before we send our proof.
  expect(challenge.serverProof).toBe(await hmacHex(token, `server|${clientNonce}`));
  const clientProof = await hmacHex(token, `client|${challenge.serverNonce}`);
  client.ws.send(JSON.stringify({ type: 'hello_response', clientProof }));
  const ack = await client.nextMessage();
  expect(ack).toEqual({ type: 'hello_ack' });
  return client;
}

async function authAndPair(
  server: BridgeWsServer,
  port: number,
  token: string,
  tab = { id: 1, url: 'https://learn.powerplatform.fyi/pl-400' },
) {
  const client = await authClient(port, token);
  const paired = new Promise<void>((resolve) => {
    server.onPairingChanged(() => {
      if (server.isPaired) resolve();
    });
  });
  client.ws.send(JSON.stringify({ type: 'paired', token, tab }));
  await paired;
  return client;
}

test('wrong client proof is rejected with close 4001', async () => {
  const { port } = startServer();
  const client = openClient(port);
  await client.waitOpen();
  client.ws.send(JSON.stringify({ type: 'hello', clientNonce: generateNonce() }));
  const challenge = (await client.nextMessage()) as { type: string; serverNonce: string };
  expect(challenge.type).toBe('hello_challenge');
  // Prove nothing: a client that does not hold the token cannot compute this.
  client.ws.send(JSON.stringify({ type: 'hello_response', clientProof: 'deadbeef' }));
  const msg = await client.nextMessage();
  expect(msg).toEqual({ type: 'error', message: expect.any(String) });
  const closed = await client.waitClose();
  expect(closed.code).toBe(4001);
});

test('server proves token possession before the client sends its proof', async () => {
  const { port, token } = startServer();
  const client = openClient(port);
  await client.waitOpen();
  const clientNonce = generateNonce();
  client.ws.send(JSON.stringify({ type: 'hello', clientNonce }));
  const challenge = (await client.nextMessage()) as {
    type: string;
    serverNonce: string;
    serverProof: string;
  };
  expect(challenge.type).toBe('hello_challenge');
  expect(typeof challenge.serverNonce).toBe('string');
  expect(challenge.serverProof).toBe(await hmacHex(token, `server|${clientNonce}`));
  // A rogue server that did not know the token could not produce that proof,
  // and the token never appeared on the wire.
});

test('sending a request before the handshake never happens: request frames need auth', async () => {
  // A request frame arriving pre-auth is a protocol violation from the server
  // side; the extension guards it. Here we assert the server itself refuses a
  // client that skips straight past the challenge.
  const { port } = startServer();
  const client = openClient(port);
  await client.waitOpen();
  client.ws.send(JSON.stringify({ type: 'hello', clientNonce: generateNonce() }));
  await client.nextMessage(); // challenge
  // Send a paired frame (post-handshake type) instead of hello_response.
  client.ws.send(
    JSON.stringify({ type: 'paired', token: 'x', tab: { id: 1, url: 'https://x' } }),
  );
  const closed = await client.waitClose();
  expect(closed.code).toBe(4001);
});

test('rejects websocket upgrade from a web-page Origin', async () => {
  const { port } = startServer();
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    headers: {
      Origin: 'https://evil.example',
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version': '13',
    },
  });
  expect(res.status).toBe(404);
  await res.text();
});

test('caps concurrent unauthenticated sockets', async () => {
  const { port } = startServer();
  const held = [];
  for (let i = 0; i < 16; i += 1) {
    const c = openClient(port);
    await c.waitOpen();
    held.push(c);
  }
  const overflow = openClient(port);
  await expect(overflow.waitOpen()).rejects.toThrow();
  for (const c of held) c.ws.close();
});

test('server sends application-level ping to keep the extension worker alive', async () => {
  const { server, token, port } = startServer({ pingIntervalMs: 20 });
  const client = await authClient(port, token);
  void server;
  const ping = await client.nextMessage();
  expect(ping).toEqual({ type: 'ping' });
});

test('oversize first message is closed 4001', async () => {
  const { port } = startServer();
  const client = openClient(port);
  await client.waitOpen();
  client.ws.send('x'.repeat(MAX_WS_MESSAGE_BYTES + 1));
  const closed = await client.waitClose();
  expect(closed.code).toBe(4001);
});

test('garbage first message is closed 4001', async () => {
  const { port } = startServer();
  const client = openClient(port);
  await client.waitOpen();
  client.ws.send('not-json');
  const closed = await client.waitClose();
  expect(closed.code).toBe(4001);
});

test('correct token yields hello_ack and isConnected true', async () => {
  const { server, token, port } = startServer();
  await authClient(port, token);
  expect(server.isConnected).toBe(true);
});

test('second authenticated client replaces the first', async () => {
  const { token, port } = startServer();
  const first = await authClient(port, token);
  const second = await authClient(port, token);
  const closed = await first.waitClose();
  expect(closed.code).toBeGreaterThan(0);
  expect(second.ws.readyState).toBe(WebSocket.OPEN);
});

test('paired then disarmed updates pairing state and fires onPairingChanged twice', async () => {
  const { server, token, port } = startServer();
  const client = await authClient(port, token);
  let count = 0;
  server.onPairingChanged(() => {
    count += 1;
  });
  client.ws.send(
    JSON.stringify({
      type: 'paired',
      token,
      tab: { id: 9, url: 'https://learn.powerplatform.fyi' },
    }),
  );
  await waitUntil(() => server.isPaired);
  expect(server.pairedTabUrl).toBe('https://learn.powerplatform.fyi');
  client.ws.send(JSON.stringify({ type: 'disarmed', token }));
  await waitUntil(() => !server.isPaired);
  expect(server.pairedTabUrl).toBeNull();
  expect(count).toBe(2);
});

test("listTools before pairing rejects 'no tab paired'", async () => {
  const { server, token, port } = startServer();
  await authClient(port, token);
  await expect(server.listTools()).rejects.toThrow('no tab paired');
});

test("listTools before connection rejects 'no extension connected'", async () => {
  const { server } = startServer();
  await expect(server.listTools()).rejects.toThrow('no extension connected');
});

test('listTools round trip', async () => {
  const { server, token, port } = startServer();
  const client = await authAndPair(server, port, token);
  const pending = server.listTools();
  const req = (await client.nextMessage()) as {
    type: string;
    id: string;
    op: string;
  };
  expect(req).toMatchObject({ type: 'request', op: 'listTools' });
  const listed = [{ name: 't1', description: 'd', inputSchema: { type: 'object' } }];
  client.ws.send(
    JSON.stringify({ type: 'response', token, id: req.id, ok: true, result: listed }),
  );
  const tools = await pending;
  expect(tools).toHaveLength(1);
  expect(tools[0].name).toBe('t1');
  // The page-authored description crosses to the client wrapped as untrusted.
  expect(tools[0].description.endsWith('d')).toBe(true);
  expect(tools[0].description).toContain('untrusted');
  expect(tools[0].inputSchema).toEqual({ type: 'object' });
});

test('callTool round trip passes content through verbatim', async () => {
  const { server, token, port } = startServer();
  const client = await authAndPair(server, port, token);
  const nested = { keep: true, n: 2 };
  const pending = server.callTool('foo', { a: 1 });
  const req = (await client.nextMessage()) as {
    type: string;
    id: string;
    op: string;
    name: string;
    args: unknown;
  };
  expect(req).toMatchObject({ type: 'request', op: 'callTool', name: 'foo', args: { a: 1 } });
  const result = { content: [{ type: 'text', text: 'hi', nested }], isError: false };
  client.ws.send(
    JSON.stringify({ type: 'response', token, id: req.id, ok: true, result }),
  );
  const got = await pending;
  expect(got.content).toEqual(result.content);
  expect(got.isError).toBe(false);
});

test('response ok:false rejects with the error text', async () => {
  const { server, token, port } = startServer();
  const client = await authAndPair(server, port, token);
  const pending = server.callTool('foo', {});
  const req = (await client.nextMessage()) as { id: string };
  client.ws.send(
    JSON.stringify({
      type: 'response',
      token,
      id: req.id,
      ok: false,
      error: 'boom from ext',
    }),
  );
  await expect(pending).rejects.toThrow('boom from ext');
});

test('malformed response is ignored then the request times out', async () => {
  const { server, token, port } = startServer({ requestTimeoutMs: 200 });
  const client = await authAndPair(server, port, token);
  const pending = server.listTools();
  await client.nextMessage();
  client.ws.send(JSON.stringify({ type: 'response', token, ok: true, result: [] }));
  await expect(pending).rejects.toThrow('extension request timed out');
});

test('tools_changed fires onToolsChanged', async () => {
  const { server, token, port } = startServer();
  const client = await authAndPair(server, port, token);
  let fired = 0;
  server.onToolsChanged(() => {
    fired += 1;
  });
  client.ws.send(JSON.stringify({ type: 'tools_changed', token }));
  await waitUntil(() => fired === 1);
});

test("disconnect while request pending rejects 'extension disconnected'", async () => {
  const { server, token, port } = startServer();
  const client = await authAndPair(server, port, token);
  const pending = server.listTools();
  await client.nextMessage();
  client.ws.close();
  await expect(pending).rejects.toThrow('extension disconnected');
});
