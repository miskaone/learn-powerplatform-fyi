# WebMCP Bridge

A companion tool — **not** part of the site build — that lets any MCP client (Claude Code,
Codex CLI, anything that speaks MCP over stdio) list and invoke the **WebMCP tools of one
explicitly paired browser tab** on `https://learn.powerplatform.fyi`.

Agent hosts like the Codex Chrome panel or Copilot can *read* pages, but none of them expose a
WebMCP *invocation* bridge yet. This closes that gap generically:

```
MCP client (stdio)
   │  JSON-RPC 2.0, newline-delimited
   ▼
bridge server (bun)  ──  MCP stdio server + WebSocket server on 127.0.0.1
   ▲
   │  ws://127.0.0.1:8765, token-authenticated
   ▼
MV3 extension service worker (WS client)
   ▼
content script relay  ──  postMessage, origin-checked
   ▼
page MAIN world  ──  document.modelContext.getTools() / executeTool()
```

Nothing here imports from `apps/` or `packages/`, and the site build is untouched.

## Layout

- `server/` — bun + TypeScript: MCP stdio server + localhost WebSocket server (zero dependencies)
- `extension/` — plain-JS MV3 Chrome extension (no bundler): service worker, content relay,
  MAIN-world caller, popup

**Works in stock Chrome.** If the page has no WebMCP runtime (no origin trial, no injecting
host), the extension's MAIN-world script installs a minimal spec-shaped
`document.modelContext` at `document_start` — the site late-binds to it and registers its
tools. A real runtime always wins: the fallback only installs when nothing is there.

## Install

### 1. Run the bridge server

```sh
cd <repo root>
bun bridge/server/main.ts            # default port 8765
bun bridge/server/main.ts --port 9000
bun bridge/server/main.ts --help
```

On startup it prints (to stderr, since stdout is the MCP transport):

```
[webmcp-bridge] WebSocket listening on ws://127.0.0.1:8765
[webmcp-bridge] Pairing token: 3fa9c2…
```

Keep that token handy — the extension needs it once per browser session.

### 2. Load the extension

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `bridge/extension/`
3. Open `https://learn.powerplatform.fyi/pl-400` (or any lesson page)
4. Click the **WebMCP Bridge** toolbar icon → paste the pairing token → **Save & connect**
5. Click **Arm this tab**

The popup shows connection + armed-tab status. Navigating the tab away (full page load or
leaving the origin) disarms it automatically; client-side route changes within the app keep it armed.

### 3. Add the bridge to an MCP client

**Claude Code:**

```sh
claude mcp add webmcp-bridge -- bun /absolute/path/to/repo/bridge/server/main.ts
```

or in `.mcp.json`:

```json
{
  "mcpServers": {
    "webmcp-bridge": {
      "command": "bun",
      "args": ["/absolute/path/to/repo/bridge/server/main.ts"]
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.webmcp-bridge]
command = "bun"
args = ["/absolute/path/to/repo/bridge/server/main.ts"]
```

Note: each MCP client launches its **own** bridge process with its **own** token and needs its own
port (`--port`) if you run several at once. One paired tab per bridge.

## What the client sees

- `tools/list` proxies the paired tab's `getTools()` live on **every** call — names, descriptions
  and `inputSchema` pass through unprefixed and unmodified. The page's tool surface is dynamic
  (e.g. `advance_module` appears only after the gate passes), so the list is never cached, and the
  bridge emits `notifications/tools/list_changed` when the page reports a `toolchange` or when
  pairing changes.
- `tools/call` forwards to the page's `executeTool()` (or the descriptor's `execute`) and returns
  the WebMCP content array verbatim as MCP content — data in, data out, never evaluated.
- While no tab is paired, `tools/list` returns a single informational `bridge_status` tool that
  explains how to pair.

## Security model (deliberately narrow)

1. **Single-origin extension.** `host_permissions` is exactly
   `https://learn.powerplatform.fyi/*` — a constant in `extension/lib/config.js`, not a wildcard.
   The extension cannot see any other site.
2. **Localhost only.** The WebSocket server binds `127.0.0.1`; nothing is reachable from the
   network.
3. **Pairing token.** The server prints a fresh random token at startup; the extension must
   present it in its `hello` and on every message. Wrong token → connection closed. The token
   lives in `chrome.storage.session` (cleared when the browser closes, never synced).
4. **Explicit per-tab arming.** Tools are reachable only on the one tab you armed in the popup.
   Full navigations and tab close disarm it; the server is told immediately.
5. **Everything is data.** Both directions are shape-validated and size-capped (1 MB per WS
   message). Tool results pass through verbatim as JSON data — never eval'd, never executed.
6. **Service-worker-safe.** MV3 may kill the worker at any time; pairing state lives in
   `chrome.storage.session` and the WS reconnects with capped exponential backoff.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `tools/list` only shows `bridge_status` | No tab paired. Popup → paste token → Save & connect → Arm this tab. |
| Popup says "needs token" | Server restarted = new token. Paste the new one. |
| Popup says "disconnected" and never connects | Is the server running? Same port in popup and `--port`? Another bridge already on 8765? |
| Arm button errors | Only `https://learn.powerplatform.fyi` tabs can be armed. |
| Tab armed but calls fail with "no modelContext" | The page hasn't initialized WebMCP yet — reload the lesson page, wait for the tool roster, re-arm. |
| Worked, then tools vanished | You navigated (full load) — that disarms by design. Re-arm from the popup. |
| Everything looks right but no round trip | `chrome://extensions` → WebMCP Bridge → "service worker" → inspect console; and check the server's stderr log. |

## Tests

```sh
bun test bridge        # bridge-only
bun test               # whole repo (site suite + bridge)
```

Covered without a browser: MCP framing (newline-delimited JSON-RPC), WS token auth (bad-token
rejection), message shape validation and size caps, no-tab behavior, reconnect backoff math, and
the extension's pure validator modules. Browser-dependent steps live in
`docs/bridge-demo-runbook.md`.
