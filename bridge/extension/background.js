import {
  DEFAULT_PORT,
  MAX_WS_MESSAGE_BYTES,
  REQUEST_TIMEOUT_MS,
  isAllowedUrl,
} from './lib/config.js';
import { nextBackoffMs } from './lib/backoff.js';
import {
  genNonce,
  hexEqual,
  hmacHex,
  makeDisarmed,
  makeHello,
  makeHelloResponse,
  makePaired,
  makeResponse,
  makeToolsChanged,
  validatePageResult,
  validateServerMessage,
} from './lib/protocol.js';

const KEEPALIVE_ALARM = 'webmcp-bridge-keepalive';

// Pairing state lives in chrome.storage.session (cleared when the browser
// closes, never synced). Token is never logged.
let ws = null;
let authed = false;
let attempt = 0;
let reconnectTimer = null;
// The client nonce we sent in `hello`, kept to verify the server's proof in
// the challenge. Per-socket; reset on every open.
let clientNonce = null;
// Which executeTool invocation form the page caller last used ('spec' |
// 'legacy' | 'direct'). Diagnostic only — reported in the popup status so the
// bridge's runtime-conformance path is observable.
let lastExecPath = null;

function errMsg(err) {
  return err && err.message ? err.message : String(err);
}

function send(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch (err) {
    console.warn('[webmcp-bridge] send failed', errMsg(err));
  }
}

function session() {
  return chrome.storage.session.get(['token', 'port', 'armed']);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  chrome.storage.session.get(['token']).then(({ token }) => {
    if (!token) return;
    const n = Math.min(attempt, 30);
    attempt = Math.min(attempt + 1, 30);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      ensureConnected();
    }, nextBackoffMs(n));
  });
}

async function ensureConnected() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const { token, port } = await session();
  if (!token) return; // status 'needs-token'
  let sock;
  try {
    sock = new WebSocket(`ws://127.0.0.1:${port || DEFAULT_PORT}`);
  } catch (err) {
    console.warn('[webmcp-bridge] ws construct failed', errMsg(err));
    scheduleReconnect();
    return;
  }
  ws = sock;
  sock.addEventListener('open', () => {
    // Send only a fresh nonce — never the token. The server must prove it
    // holds the token (challenge) before we send our own proof.
    clientNonce = genNonce();
    send(makeHello(clientNonce));
  });
  sock.addEventListener('message', async (ev) => {
    const raw = typeof ev.data === 'string' ? ev.data : String(ev.data);
    const parsed = validateServerMessage(raw);
    if (!parsed.ok) {
      console.warn('[webmcp-bridge] invalid server message', parsed.error);
      return;
    }
    const m = parsed.msg;
    if (m.type === 'hello_challenge') {
      const { token: t } = await session();
      if (!t || !clientNonce) {
        try { sock.close(4002, 'no token'); } catch { /* already closing */ }
        return;
      }
      const expected = await hmacHex(t, `server|${clientNonce}`);
      if (!hexEqual(expected, m.serverProof)) {
        // The peer on this port does not hold the pairing token: a rogue
        // local process, not our bridge. Drop it and never reveal anything.
        console.warn('[webmcp-bridge] server failed challenge; closing');
        try { sock.close(4002, 'server auth failed'); } catch { /* already closing */ }
        return;
      }
      const clientProof = await hmacHex(t, `client|${m.serverNonce}`);
      if (ws === sock) send(makeHelloResponse(clientProof));
    } else if (m.type === 'hello_ack') {
      authed = true;
      attempt = 0;
      const { token: t, armed } = await session();
      if (t && armed) send(makePaired(t, armed.tabId, armed.url));
    } else if (m.type === 'ping') {
      // Keepalive only. Receiving it resets this worker's MV3 idle timer.
    } else if (m.type === 'error') {
      console.warn('[webmcp-bridge] server error', m.message);
    } else if (m.type === 'request') {
      // Never act on a request before hello_ack: the server must have proven
      // token possession first.
      if (!authed) {
        console.warn('[webmcp-bridge] request before handshake complete; closing');
        try { sock.close(4002, 'unauthenticated server'); } catch { /* already closing */ }
        return;
      }
      await handleRequest(m);
    }
  });
  sock.addEventListener('close', () => {
    if (ws !== sock) return;
    authed = false;
    ws = null;
    scheduleReconnect();
  });
  sock.addEventListener('error', () => {
    authed = false;
  });
}

async function handleRequest(msg) {
  const { token, armed } = await session();
  if (!token) return;
  if (!armed) {
    send(makeResponse(token, msg.id, false, 'no tab armed'));
    return;
  }
  try {
    const tab = await chrome.tabs.get(armed.tabId);
    if (!isAllowedUrl(tab.url)) {
      await clearArmed(token);
      send(makeResponse(token, msg.id, false, 'armed tab left allowed origin'));
      return;
    }
    const reply = await Promise.race([
      chrome.tabs.sendMessage(armed.tabId, {
        kind: 'webmcp-bridge-request',
        id: msg.id,
        op: msg.op,
        name: msg.name,
        args: msg.args,
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('request timed out')), REQUEST_TIMEOUT_MS);
      }),
    ]);
    if (!reply || reply.ok !== true) {
      send(makeResponse(token, msg.id, false, (reply && reply.error) || 'page request failed'));
      return;
    }
    if (typeof reply.execPath === 'string') lastExecPath = reply.execPath;
    const checked = validatePageResult(msg.op, reply.result);
    if (!checked.ok) {
      send(makeResponse(token, msg.id, false, checked.error));
      return;
    }
    sendResult(token, msg.id, checked.result);
  } catch (err) {
    send(makeResponse(token, msg.id, false, errMsg(err)));
  }
}

// Send a successful result, but never a frame the server would reject as
// oversize. An unbounded page result would otherwise hang the MCP client for
// the full request timeout, or trip Bun's transport limit and unpair the
// bridge. Cap it here and return a clean error instead.
function sendResult(token, id, result) {
  const ok = makeResponse(token, id, true, result);
  let bytes = Infinity;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(ok)).byteLength;
  } catch {
    /* circular / unserializable — fall through to the error path */
  }
  if (bytes > MAX_WS_MESSAGE_BYTES) {
    send(makeResponse(token, id, false, 'tool result too large'));
    return;
  }
  send(ok);
}

async function clearArmed(token) {
  await chrome.storage.session.set({ armed: null });
  if (authed && token) send(makeDisarmed(token));
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { token, armed } = await session();
  if (armed && armed.tabId === tabId) await clearArmed(token);
});

// Full navigations disarm; same-document SPA route changes keep the arm.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const { token, armed } = await session();
  if (!armed || armed.tabId !== tabId) return;
  const left = Boolean(changeInfo.url) && !isAllowedUrl(changeInfo.url);
  if (changeInfo.status === 'loading' || left) await clearArmed(token);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureConnected();
  if (msg && msg.kind === 'webmcp-bridge-toolchange') {
    // Only the armed tab's own content script may signal a toolchange.
    if (sender.id !== chrome.runtime.id || !sender.tab) return;
    session().then(({ token, armed }) => {
      if (!armed || sender.tab.id !== armed.tabId) return;
      if (authed && token) send(makeToolsChanged(token));
    });
    return;
  }
  if (!msg || !msg.cmd) return;
  // Control commands come only from the extension's own popup — same
  // extension id AND no originating tab (content scripts carry sender.tab).
  if (sender.id !== chrome.runtime.id || sender.tab) {
    sendResponse({ ok: false, error: 'unauthorized sender' });
    return true;
  }
  handlePopup(msg).then(sendResponse, (err) => sendResponse({ ok: false, error: errMsg(err) }));
  return true;
});

async function handlePopup(msg) {
  if (msg.cmd === 'status') {
    const { token, port, armed } = await session();
    let wsState = 'disconnected';
    if (!token) wsState = 'needs-token';
    else if (ws && ws.readyState === WebSocket.CONNECTING) wsState = 'connecting';
    else if (ws && ws.readyState === WebSocket.OPEN) wsState = authed ? 'authed' : 'connected';
    return {
      hasToken: Boolean(token),
      port: port || DEFAULT_PORT,
      wsState,
      armed: armed || null,
      execPath: lastExecPath,
    };
  }
  if (msg.cmd === 'set-token') {
    // A new token means a different bridge process. Clear any existing arm so
    // the pairing cannot silently transfer to it — the user must re-arm and
    // consent to the new bridge explicitly.
    await chrome.storage.session.set({
      token: String(msg.token || '').trim(),
      port: Number(msg.port) || DEFAULT_PORT,
      armed: null,
    });
    attempt = 0;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    const sock = ws;
    ws = null;
    authed = false;
    if (sock) try { sock.close(); } catch { /* already closing */ }
    await ensureConnected();
    return { ok: true };
  }
  if (msg.cmd === 'arm') {
    // Re-read the tab from the browser rather than trusting the popup's
    // reported url — the stored/paired url must be the real current one.
    let tab;
    try {
      tab = await chrome.tabs.get(msg.tabId);
    } catch {
      return { ok: false, error: 'tab not found' };
    }
    const url = tab.url || '';
    if (!isAllowedUrl(url)) {
      return { ok: false, error: 'only learn.powerplatform.fyi tabs can be armed' };
    }
    const armed = { tabId: tab.id, url };
    await chrome.storage.session.set({ armed });
    const { token } = await session();
    if (authed && token) send(makePaired(token, armed.tabId, armed.url));
    return { ok: true };
  }
  if (msg.cmd === 'disarm') {
    const { token } = await session();
    await clearArmed(token);
    return { ok: true };
  }
  return { ok: false, error: 'unknown cmd' };
}

// Keepalive backstop: the MV3 service worker is killed after ~30s idle. A
// periodic alarm wakes it and re-establishes the socket if it dropped, so a
// paired tab stays reachable across a silent stretch (e.g. mid-demo). The
// server's inbound ping keeps an already-open socket's worker alive between
// alarms; this alarm recovers a socket that actually died. 30s is Chrome's
// minimum alarm period.
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) ensureConnected();
});

ensureConnected();
chrome.runtime.onStartup.addListener(() => ensureConnected());
chrome.runtime.onInstalled.addListener(() => ensureConnected());
