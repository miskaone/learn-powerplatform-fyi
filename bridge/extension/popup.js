const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const tokenEl = document.getElementById('token');
const portEl = document.getElementById('port');

function send(payload) {
  return chrome.runtime.sendMessage(payload);
}

function describe(status) {
  const parts = [];
  switch (status.wsState) {
    case 'needs-token':
      parts.push('Needs a pairing token');
      break;
    case 'connecting':
      parts.push('Connecting to bridge…');
      break;
    case 'connected':
      parts.push('Connected, waiting for handshake');
      break;
    case 'authed':
      parts.push('Bridge connected');
      break;
    default:
      parts.push('Disconnected from bridge');
  }
  if (status.armed && status.armed.tabId != null) {
    parts.push(`armed tab ${status.armed.tabId}`);
  } else {
    parts.push('no tab armed');
  }
  return parts.join(' — ');
}

async function refresh(errorText) {
  try {
    const status = await send({ cmd: 'status' });
    statusEl.textContent = describe(status);
    if (typeof status.port === 'number' && document.activeElement !== portEl) {
      portEl.value = String(status.port);
    }
    errorEl.textContent = errorText || '';
  } catch (err) {
    statusEl.textContent = 'Extension error';
    errorEl.textContent = err && err.message ? err.message : String(err);
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const token = tokenEl.value;
  const port = Number(portEl.value) || 8765;
  await send({ cmd: 'set-token', token, port });
  await refresh();
});

document.getElementById('arm').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    await refresh('no active tab');
    return;
  }
  const res = await send({ cmd: 'arm', tabId: tab.id, url: tab.url });
  await refresh(res && res.ok === false ? res.error : '');
});

document.getElementById('disarm').addEventListener('click', async () => {
  await send({ cmd: 'disarm' });
  await refresh();
});

refresh();
setInterval(() => {
  refresh();
}, 2000);
