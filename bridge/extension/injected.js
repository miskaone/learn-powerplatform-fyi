// Mirror of lib/config.js — MAIN-world scripts are not modules.
const RELAY_SOURCE_TO_PAGE = 'webmcp-bridge:to-page';
const RELAY_SOURCE_FROM_PAGE = 'webmcp-bridge:from-page';

// Demo fallback provider. Stock Chrome ships no WebMCP runtime yet, but the
// page late-binds to document.modelContext (it polls for two minutes). When
// NO runtime exists at document_start we install a minimal spec-shaped one so
// the page can register its tools and the bridge can call them. Real runtimes
// (Chrome origin trial, ChatGPT injection) always win: we only install when
// nothing is there, and we never overwrite an existing modelContext.
(function installFallbackModelContext() {
  const existing =
    (document.modelContext && typeof document.modelContext === 'object') ||
    (navigator.modelContext && typeof navigator.modelContext === 'object');
  if (existing) return;

  const tools = new Map();
  const listeners = new Set();
  const fireToolchange = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* listener error is the page's problem, not ours */
      }
    }
  };

  document.modelContext = {
    __webmcpBridgeFallback: true,
    // Promise-returning like real runtimes; duplicate names throw; an
    // AbortSignal deregisters (matches the page's revocation contract).
    async registerTool(tool, options) {
      if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) {
        throw new Error('invalid tool');
      }
      if (tools.has(tool.name)) throw new Error('duplicate tool: ' + tool.name);
      const signal = options && options.signal;
      if (signal && signal.aborted) return;
      tools.set(tool.name, tool);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            tools.delete(tool.name);
            fireToolchange();
          },
          { once: true },
        );
      }
      fireToolchange();
    },
    async getTools() {
      return [...tools.values()];
    },
    async executeTool(name, args) {
      const tool = tools.get(name);
      if (!tool || typeof tool.execute !== 'function') {
        throw new Error('unknown tool: ' + name);
      }
      return tool.execute(args);
    },
    addEventListener(type, listener) {
      if (type === 'toolchange' && typeof listener === 'function') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'toolchange') listeners.delete(listener);
    },
  };
})();

let bound = false;

function resolveModelContext() {
  if (document.modelContext && typeof document.modelContext === 'object') {
    return document.modelContext;
  }
  if (navigator.modelContext && typeof navigator.modelContext === 'object') {
    return navigator.modelContext;
  }
  return null;
}

function bindToolchange(mc) {
  if (bound || !mc || typeof mc.addEventListener !== 'function') return;
  bound = true;
  try {
    mc.addEventListener('toolchange', () => {
      window.postMessage(
        { source: RELAY_SOURCE_FROM_PAGE, kind: 'toolchange' },
        window.location.origin,
      );
    });
  } catch {
    bound = false;
  }
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function mapTool(entry) {
  let name = '';
  let description = '';
  let inputSchema = { type: 'object' };
  try {
    if (entry && typeof entry.name === 'string') name = entry.name;
  } catch {
    /* field getter threw */
  }
  try {
    if (entry && typeof entry.description === 'string') description = entry.description;
  } catch {
    /* field getter threw */
  }
  try {
    if (entry && entry.inputSchema && typeof entry.inputSchema === 'object') {
      const cloned = cloneJson(entry.inputSchema, { type: 'object' });
      if (cloned && typeof cloned === 'object' && !Array.isArray(cloned)) inputSchema = cloned;
    }
  } catch {
    /* field getter threw */
  }
  return { name, description, inputSchema };
}

function replyTo(id, payload) {
  window.postMessage(
    { source: RELAY_SOURCE_FROM_PAGE, id, ...payload },
    window.location.origin,
  );
}

async function handle(data) {
  const mc = resolveModelContext();
  if (!mc) {
    replyTo(data.id, { ok: false, error: 'no modelContext on this page' });
    return;
  }
  bindToolchange(mc);

  try {
    if (data.op === 'listTools') {
      const tools = await Promise.resolve(mc.getTools());
      const list = Array.isArray(tools) ? tools.map(mapTool) : [];
      replyTo(data.id, { ok: true, result: list });
      return;
    }
    if (data.op === 'callTool') {
      const name = data.name;
      const args = data.args;
      let result;
      if (typeof mc.executeTool === 'function') {
        result = await mc.executeTool(name, args);
      } else {
        const tools = await Promise.resolve(mc.getTools());
        const list = Array.isArray(tools) ? tools : [];
        const descriptor = list.find((t) => t && t.name === name);
        if (!descriptor || typeof descriptor.execute !== 'function') {
          replyTo(data.id, { ok: false, error: 'tool not found: ' + name });
          return;
        }
        result = await descriptor.execute(args);
      }
      const sanitized = cloneJson(result, result);
      replyTo(data.id, { ok: true, result: sanitized });
      return;
    }
    replyTo(data.id, { ok: false, error: 'unknown op' });
  } catch (e) {
    replyTo(data.id, { ok: false, error: String((e && e.message) || e) });
  }
}

window.addEventListener('message', (event) => {
  // Origin + source checks: MAIN world sees every postMessage. Accept only
  // same-window, same-origin frames tagged with our relay source.
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== RELAY_SOURCE_TO_PAGE) return;
  handle(data);
});

try {
  const mc = resolveModelContext();
  if (mc) bindToolchange(mc);
} catch {
  /* page not ready */
}
