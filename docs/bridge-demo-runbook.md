# WebMCP Bridge — demo runbook

On-camera script for the "art of the possible" demo: a terminal MCP client drives the live
lesson page through its WebMCP tools, and the page visibly reacts.

**The shot:** terminal on the left, Chrome on `https://learn.powerplatform.fyi/pl-400` on the
right. Terminal lists tools → calls `get_current_question` → submits an answer → the page's
roster/verdict updates while the terminal shows the round trip.

## Rehearsal checklist (do all of this before recording)

1. `cd <repo>` and `bun test bridge` — green.
2. Start the server in its own visible terminal pane:
   `bun bridge/server/main.ts`
   Confirm the two stderr lines: WS listening + pairing token.
3. Chrome: extension loaded unpacked from `bridge/extension/` (chrome://extensions, dev mode).
   If you reloaded the extension, the session token is gone — re-paste it.
4. Open the lesson page, wait until the on-page tool roster renders (WebMCP is live). Stock
   Chrome works: with no WebMCP runtime present, the extension installs a minimal
   document.modelContext fallback at document_start and the page binds to it. Load the
   extension BEFORE opening the page (or reload the page after loading the extension).
5. Extension popup → paste token → Save & connect → status shows connected → **Arm this tab**.
6. Sanity round trip *before* recording, with Claude Code as the MCP client:
   - `claude mcp add webmcp-bridge -- bun <abs path>/bridge/server/main.ts` (once)
   - in a Claude Code session: "list the tools from webmcp-bridge" → expect the mastery-gate
     roster (get_learner_state, get_current_question, submit_answer, …), unprefixed.
   - Important: the client spawns its own bridge process = **its own token**. Pair against the
     token printed by *that* process (watch the client's MCP logs/stderr), not a bridge you
     started by hand earlier. If you want the hand-started server on camera, use Codex CLI or
     any client configured to that same process — or simply show the client-spawned server's
     stderr pane.

   Simplest reliable staging: let the MCP client spawn the bridge, find its token in the
   client's MCP stderr output, pair the tab against that. Rehearse this once so you know where
   your client surfaces MCP server stderr (Claude Code: `claude --debug` / MCP logs).

## Script

1. **Cold open on the page.** "This lesson page publishes WebMCP tools — but no agent host can
   actually *call* them yet. This bridge fixes that for any MCP client."
2. **Show the server pane.** Point at the pairing token line. "Random token per run, localhost
   only, one origin, one tab — paired explicitly in the extension popup." Show the popup: armed.
3. **List tools.** In the MCP client: ask it to list webmcp-bridge tools. Call out that these
   are the page's own names, passed straight through.
4. **Read state.** Call `get_current_question`. Read the question aloud off the terminal —
   then point at the same question on the page.
5. **Act.** Call `submit_answer` with a choice (rehearse which one is correct).
   **The page updates on its own** — verdict, roster, coaching state. That's the money shot:
   terminal round trip on the left, DOM reacting on the right.
6. **Dynamic surface (optional but strong).** Progress the lesson until the gate passes and
   `advance_module` appears; run tools/list again — the roster grew. "The tool surface is live;
   the bridge re-queries the page every time and pushes list_changed notifications."
7. **Close on security.** One breath: single-origin extension, localhost socket, pasted token,
   per-tab arming, everything validated and size-capped, results passed through as data.

## Failure fallbacks

| If | Then |
|---|---|
| Client lists only `bridge_status` | Tab not paired (or paired against a different bridge process). Call `bridge_status` on camera — it says exactly that — then pair and retry. Honest recovery reads well. |
| WS won't connect | Server not running / port mismatch / second bridge holding 8765. Restart with `--port 9001` and update the popup port. |
| "no modelContext on this page" | You armed a non-lesson route, or the extension was loaded after the page. Reload the lesson (the extension installs its fallback modelContext at document_start when no runtime exists), wait for the roster, re-arm. |
| Nothing after navigating mid-demo | Full navigation disarms by design. Re-arm from the popup; narrate it as the security model working. |
| Tool call hangs then errors | Service worker was asleep and reconnecting; retry once — backoff caps at 15 s. If persistent, inspect the worker console from chrome://extensions. |
| Total bridge failure on camera | Fall back to the page's built-in coach flow and the `bridge_status` story; the WebMCP surface itself still demos. |

## Reset between takes

- Disarm via popup; hard-reload the lesson page (clears verdict state you already answered).
- If you restarted the bridge/client: new token → re-paste → re-arm.
- Server pane: clear scrollback so the token line is the first thing visible.
