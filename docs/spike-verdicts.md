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

## Chrome 152 + `#enable-webmcp-testing` — ISC-1 (run 2026-08-29)

Chrome **152.0.0.0** — the stable release judges will be running (152 shipped
2026-08-25; 153 lands 2026-09-08, five days AFTER the deadline).

| Probe | Verdict | Evidence |
|---|---|---|
| `document.modelContext` | **PRESENT** | verdict block, 11:39 run |
| `navigator.modelContext` | **ABSENT** | verdict block — document-first is correct in BOTH target environments |
| `registerTool` / `getTools` / `executeTool` | present | capabilities line |
| `addEventListener` (`toolchange`) | **PRESENT** — unlike ChatGPT | `EVENT toolchange fired` on every registration and revocation |
| Mid-session (late) registration | works, fires `toolchange` | log 11:40:12 |
| Deregistration via AbortSignal | works, fires `toolchange`, tool leaves `getTools()` | log 11:40:18 |
| **In-flight abort** | **KILLS the in-flight execution** — `executeTool` rejected: "The provided value is not of type 'RegisteredTool'" | log 11:40:21–23, 8s tool aborted at t+2s |

### Binding consequences (all already implemented)

1. **The drain-first rule is empirically required, not precautionary.** Aborting a
   registration during an active execution kills that call on Chrome 152 — reproduced
   here, in the browser the judges will use. `ToolRegistry` drains before it aborts.
2. **Both watcher modes are now real, and each target uses a different one:** Chrome
   takes the `toolchange` event path; ChatGPT (no `addEventListener`) takes the
   `getTools()` polling path. The feature-detecting `ToolSurfaceWatcher` was built for
   exactly this split — and each half is now confirmed against a live runtime.
3. **`document.modelContext` only** — confirmed in both environments; the `navigator`
   fallback remains dead code retained for spec-compat.

**Open:** the product itself has been exercised live in ChatGPT (polling path) but not
yet in Chrome-with-flag (events path). That is a submission requirement ("testable in
Chrome with WebMCP enabled") and the last unexercised runtime path.

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

## Edge + Copilot — third runtime (2026-08-29, PROVISIONAL)

Owner reports the flag works in Edge (`edge://flags/#enable-webmcp-testing`) and
that **Microsoft Copilot also appears to drive the tool surface**. Provisional
pending evidence of what Copilot actually did (tool listing vs execution).

If confirmed, this is the strongest available proof of the product's central
architectural claim: the site publishes tools and *whatever agent the visitor
brings* becomes the coach — demonstrated across two competing vendors' agents
(OpenAI ChatGPT, Microsoft Copilot) with zero vendor-specific code. Nothing in
the implementation targets a vendor: the shim feature-detects
`document.modelContext` and the watcher adapts to whichever notification mode
the runtime offers.

Domain resonance worth naming in the writeup: this is a **Power Platform**
certification course, and the agent that works is **Microsoft's own**, in the
browser Microsoft-ecosystem learners already have. The product reaches its real
audience through its native tooling.

**Claim discipline:** do not state Copilot support in the Devpost submission
until the evidence line below is filled in. Unverified vendor claims are exactly
the kind of thing a judge checks.

- Evidence (2026-08-28, RESOLVED — claim NOT supported): Copilot in Edge reads the
  page and quotes the roster/tool descriptions, but states plainly it has no
  invocation bridge: "that bridge is not exposed as a callable tool in this
  Copilot session." Same class as the Codex side panel: page-text access only.
  **Verified invocation hosts remain exactly the two the contest names:**
  ChatGPT desktop-app browser (conversational agent, full loop) and Chrome 152+
  with the flag (API-level, verified via devtools executeTool). The earlier
  "seems to work with Copilot" was roster-text reading. Do not claim Copilot.
