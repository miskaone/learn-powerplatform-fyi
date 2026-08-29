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
    // Spec form (webmachinelearning.github.io/webmcp, draft 2026-08-26):
    // executeTool(RegisteredTool, inputJsonString) -> Promise<DOMString>.
    // Chrome 152 enforces this strictly ("The provided value is not of type
    // 'RegisteredTool'"). The legacy (nameString, argsObject) form is kept for
    // back-compat with pages written against the pre-spec shape.
    async executeTool(toolOrName, args) {
      if (typeof toolOrName === 'string') {
        // Legacy form: (name, argsObject) -> raw tool result.
        const tool = tools.get(toolOrName);
        if (!tool || typeof tool.execute !== 'function') {
          throw new Error('unknown tool: ' + toolOrName);
        }
        return tool.execute(args);
      }
      if (!toolOrName || typeof toolOrName.name !== 'string' || !tools.has(toolOrName.name)) {
        throw new TypeError("The provided value is not of type 'RegisteredTool'");
      }
      if (typeof args !== 'string') {
        throw new TypeError('executeTool input must be a JSON string');
      }
      const tool = tools.get(toolOrName.name);
      const parsed = args.length === 0 ? {} : JSON.parse(args);
      const result = await tool.execute(parsed);
      // Spec returns a DOMString: stringify the tool's response.
      return typeof result === 'string' ? result : JSON.stringify(result);
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

// Which executeTool invocation form last succeeded: 'spec' (RegisteredTool +
// JSON string, per the 2026-08-26 draft), 'legacy' (nameString + argsObject),
// or 'direct' (no executeTool on the runtime; descriptor.execute called).
// Exposed for diagnostics and relayed with each callTool reply so the
// extension's status surface can report it.
let lastExecPath = null;

function noteExecPath(path) {
  if (lastExecPath === path) return;
  lastExecPath = path;
  try {
    window.__webmcpBridgeExecPath = path;
  } catch {
    /* frozen window — diagnostics only */
  }
  try {
    console.info('[webmcp-bridge] executeTool path: ' + path);
  } catch {
    /* console unavailable */
  }
}

// A rejection that means "the call form was wrong", not "the tool failed".
// Chrome 152 throws TypeError("The provided value is not of type
// 'RegisteredTool'"); a legacy host handed (toolObject, jsonString) instead
// fails its name lookup ("unknown tool: [object Object]" or similar).
function isSignatureRejection(e) {
  if (e instanceof TypeError) return true;
  const msg = String((e && e.message) || e);
  return /RegisteredTool|unknown tool|not found/i.test(msg);
}

// Normalize whatever executeTool resolved with to MCP content for the server:
// spec runtimes resolve a DOMString (usually JSON), legacy runtimes and the
// fallback polyfill resolve the ToolResponse object ({content:[...]}).
function normalizeToolResult(raw) {
  if (typeof raw === 'string') {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.content)) {
      return parsed;
    }
    return { content: [{ type: 'text', text: raw }] };
  }
  if (raw && typeof raw === 'object' && Array.isArray(raw.content)) {
    return cloneJson(raw, raw);
  }
  let text;
  try {
    text = JSON.stringify(raw);
  } catch {
    text = String(raw);
  }
  return { content: [{ type: 'text', text: typeof text === 'string' ? text : String(raw) }] };
}

// Spec-correct invocation with a defensive dual path. Spec first: resolve the
// RegisteredTool object via getTools() (match by name) and pass a JSON string
// — the form Chrome 152 requires. If that is rejected at call time (ChatGPT's
// injected implementation may still expect the pre-spec form), retry the
// legacy (name, argsObject) call once.
async function invokeTool(mc, name, args) {
  let registered = null;
  try {
    const tools = await Promise.resolve(mc.getTools());
    if (Array.isArray(tools)) {
      registered = tools.find((t) => t && t.name === name) || null;
    }
  } catch {
    /* getTools failed — fall through to the legacy form */
  }
  if (registered) {
    try {
      const raw = await mc.executeTool(registered, JSON.stringify(args === undefined ? {} : args));
      noteExecPath('spec');
      return raw;
    } catch (e) {
      if (!isSignatureRejection(e)) throw e;
      // Signature rejection happens before the tool executes, so a single
      // legacy retry cannot double-execute the tool.
    }
  }
  const raw = await mc.executeTool(name, args);
  noteExecPath('legacy');
  return raw;
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
        result = await invokeTool(mc, name, args);
      } else {
        const tools = await Promise.resolve(mc.getTools());
        const list = Array.isArray(tools) ? tools : [];
        const descriptor = list.find((t) => t && t.name === name);
        if (!descriptor || typeof descriptor.execute !== 'function') {
          replyTo(data.id, { ok: false, error: 'tool not found: ' + name });
          return;
        }
        result = await descriptor.execute(args);
        noteExecPath('direct');
      }
      const normalized = normalizeToolResult(result);
      const reply = { ok: true, result: normalized };
      if (lastExecPath) reply.execPath = lastExecPath;
      replyTo(data.id, reply);
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
