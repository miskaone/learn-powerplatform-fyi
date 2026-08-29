import { ALLOWED_ORIGIN, DEFAULT_PORT, REQUEST_TIMEOUT_MS } from './lib/config.js';
import { nextBackoffMs } from './lib/backoff.js';
import {
  makeDisarmed,
  makeHello,
  makePaired,
  makeResponse,
  makeToolsChanged,
  validatePageResult,
  validateServerMessage,
} from './lib/protocol.js';

// Pairing state lives in chrome.storage.session (cleared when the browser
// closes, never synced). Token is never logged.
let ws = null;
let authed = false;
let attempt = 0;
let reconnectTimer = null;

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
  sock.addEventListener('open', async () => {
    const { token: t } = await session();
    if (t) send(makeHello(t));
  });
  sock.addEventListener('message', async (ev) => {
    const raw = typeof ev.data === 'string' ? ev.data : String(ev.data);
    const parsed = validateServerMessage(raw);
    if (!parsed.ok) {
      console.warn('[webmcp-bridge] invalid server message', parsed.error);
      return;
    }
    if (parsed.msg.type === 'hello_ack') {
      authed = true;
      attempt = 0;
      const { token: t, armed } = await session();
      if (t && armed) send(makePaired(t, armed.tabId, armed.url));
    } else if (parsed.msg.type === 'error') {
      console.warn('[webmcp-bridge] server error', parsed.msg.message);
    } else if (parsed.msg.type === 'request') {
      await handleRequest(parsed.msg);
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
    if (!(tab.url || '').startsWith(ALLOWED_ORIGIN)) {
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
    const checked = validatePageResult(msg.op, reply.result);
    send(
      checked.ok
        ? makeResponse(token, msg.id, true, checked.result)
        : makeResponse(token, msg.id, false, checked.error),
    );
  } catch (err) {
    send(makeResponse(token, msg.id, false, errMsg(err)));
  }
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
  const left = Boolean(changeInfo.url) && !changeInfo.url.startsWith(ALLOWED_ORIGIN);
  if (changeInfo.status === 'loading' || left) await clearArmed(token);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureConnected();
  if (msg && msg.kind === 'webmcp-bridge-toolchange') {
    session().then(({ token, armed }) => {
      if (!armed || !sender.tab || sender.tab.id !== armed.tabId) return;
      if (authed && token) send(makeToolsChanged(token));
    });
    return;
  }
  if (!msg || !msg.cmd) return;
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
    return { hasToken: Boolean(token), port: port || DEFAULT_PORT, wsState, armed: armed || null };
  }
  if (msg.cmd === 'set-token') {
    await chrome.storage.session.set({
      token: String(msg.token || '').trim(),
      port: Number(msg.port) || DEFAULT_PORT,
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
    const url = String(msg.url || '');
    if (!url.startsWith(ALLOWED_ORIGIN)) {
      return { ok: false, error: 'only learn.powerplatform.fyi tabs can be armed' };
    }
    const armed = { tabId: msg.tabId, url };
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

ensureConnected();
chrome.runtime.onStartup.addListener(() => ensureConnected());
chrome.runtime.onInstalled.addListener(() => ensureConnected());
