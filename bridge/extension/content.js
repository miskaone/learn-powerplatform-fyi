// Mirror of lib/config.js — content scripts are not modules.
const RELAY_SOURCE_TO_PAGE = 'webmcp-bridge:to-page';
const RELAY_SOURCE_FROM_PAGE = 'webmcp-bridge:from-page';

const pending = new Map();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.kind !== 'webmcp-bridge-request') return;
  const { id, op, name, args } = msg;
  const timer = setTimeout(() => {
    const waiter = pending.get(id);
    if (!waiter) return;
    pending.delete(id);
    waiter({ ok: false, error: 'page did not respond' });
  }, 9000);
  pending.set(id, (value) => {
    clearTimeout(timer);
    sendResponse(value);
  });
  // Origin-locked postMessage: only this window, only this origin. The page
  // never receives a wildcard target and we never accept cross-origin frames.
  window.postMessage(
    { source: RELAY_SOURCE_TO_PAGE, id, op, name, args },
    window.location.origin,
  );
  return true;
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== RELAY_SOURCE_FROM_PAGE) return;

  if (data.kind === 'toolchange') {
    try {
      chrome.runtime.sendMessage({ kind: 'webmcp-bridge-toolchange' });
    } catch {
      /* SW may be restarting */
    }
    return;
  }

  if (typeof data.id !== 'string') return;
  const waiter = pending.get(data.id);
  if (!waiter) return;
  pending.delete(data.id);
  const reply = { ok: Boolean(data.ok) };
  if ('result' in data) reply.result = data.result;
  if ('error' in data) reply.error = data.error;
  waiter(reply);
});
