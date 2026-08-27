# WebMCP Spike Verdicts — 2026-08-26

Instrument: `apps/web/public/spike.html`, live at https://learn.powerplatform.fyi/spike.
Run by the owner in the ChatGPT desktop app's in-app browser against the live page,
with the resident ChatGPT agent answering discovery/execution questions between steps.

## ChatGPT in-app browser (primary judge environment) — ISC-2

| Probe | Verdict | Evidence |
|---|---|---|
| `document.modelContext` | **PRESENT** | verdict block screenshot, 19:08 run |
| `navigator.modelContext` | **ABSENT** (deprecated path not served) | verdict block |
| Chromium base | **151** (one behind stable 152; WebMCP is injected by ChatGPT independently of upstream) | userAgent string |
| `registerTool` / `getTools` / `executeTool` | present | capabilities line |
| `addEventListener` (`toolchange`) | **NOT A FUNCTION** — no event surface in ChatGPT's injected implementation | log 19:08:16.088 |
| Immediate registration | works (`spike_echo`, `spike_slow`) | log |
| **Mid-session (late) registration visible to the agent** | **YES — agent listed AND executed `spike_late_tool`** | agent run + page log |
| **Deregistration honored by the agent** | **YES — aborting the registration removed `spike_echo` from the agent's tool list** | agent run |
| In-flight abort behavior | not yet run (button-3 self-test pending) | — |

## Chrome + `#enable-webmcp-testing` — ISC-1

Pending — Part B of the spike checklist not yet run.

## Binding consequences (applied to the build)

1. **Namespace order flips: `document.modelContext` first**, `navigator` retained only
   as a backward-compat fallback. The overnight shim's preference was backwards.
2. **No `toolchange` dependency anywhere.** Registry and Tool Roster treat the event
   as an optional enhancement; the required mechanism is agent-side notification +
   `getTools()` refresh (polling).
3. **The flagship demo beat is safe in the primary environment**: `advance_module`
   can genuinely materialize mid-session and the agent will see it. No refusal-state
   pivot needed for ChatGPT; the fallback stays behind the registry interface anyway.
4. **Exam Mode ships REAL revocation** with a hard drain-first rule: never abort a
   registration while an execution is in flight (Chromium <153 kills in-flight calls;
   ChatGPT's base is 151). Revocation waits for active executions to settle.
