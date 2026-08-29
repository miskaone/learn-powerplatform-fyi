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
| **In-flight abort** | **NOT REPRODUCED — probe invalid.** `executeTool` rejected with "The provided value is not of type 'RegisteredTool'": a call-time signature type-error (the self-test passed a name string where the spec requires the RegisteredTool object), thrown before the tool ever executed. Says nothing about in-flight behavior. | log 11:40:21–23; see 2026-08-29 correction below |

> **2026-08-29 correction.** This row previously read "KILLS the in-flight
> execution", inferring an in-flight abort kill from the button-3 rejection.
> That inference was wrong: the rejection was Chrome 152 enforcing the spec
> signature `executeTool(RegisteredTool, inputJsonString)` — a type error at
> call time, not an execution that started and was then killed. The spike's
> button-3 self-test and the bridge caller now use the spec-correct form (with
> a legacy fallback) and the self-test log distinguishes call-time rejection,
> started-then-killed, and survived-abort outcomes. The in-flight-abort hazard
> itself remains sourced from Chrome's release notes (the Chrome 153 fix note
> for in-flight abort behavior); it has not been reproduced live here.

### Binding consequences (all already implemented)

1. **The drain-first rule stands on the release notes plus prudence — not on a live
   reproduction.** Chrome's 153 fix note documents that aborting a registration
   could kill an in-flight execution on earlier builds; our own probe never
   reproduced the kill (see the correction above — the observed rejection was a
   signature type-error). `ToolRegistry` drains before it aborts regardless: the
   hazard is documented upstream, the cost of draining is nil, and the exposure
   window (Chrome 152 is the judges' stable) is exactly the deadline window.
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

## DECISIVE: real-runtime registration verified, Chrome 152 (2026-08-29)

The evidence gap that mattered: every prior "verified" was against an injected
MOCK `document.modelContext`. That proves our code against our model of the API,
not against a real browser implementation. Closed now.

Owner ran, in DevTools on the live product page in Chrome 152.0.7977.65 with
`#enable-webmcp-testing` enabled:

```js
document.modelContext.getTools().then(t => console.log(t.length, t.map(x => x.name)))
```

Result — the **browser's own** WebMCP API reporting our registrations:

```
12 ['get_current_context', 'get_current_question', 'get_hint',
    'get_learner_state', 'get_lesson_brief', 'log_coaching_note',
    'navigate_to_anchor', 'prescribe_drill', 'request_next_action',
    'score_rubric', 'set_lesson_aim', 'submit_answer']
```

Conclusions:
1. **Registration against the real Chrome implementation is correct** — all 12
   tools, exact names, in the second contest-named environment, on the live
   product (not the spike page). The mock was faithful.
2. Chrome returns tools **alphabetically**, not in registration order. Our
   `canonicalToolOrder()` normalizes whatever `getTools()` returns, so the
   on-page roster stays stable regardless of host ordering — already handled.
3. Therefore every remaining failure observed tonight is **host invocation
   bridging**, not this site. Survey after five surfaces:

| Host | Discovers | Invokes |
|---|---|---|
| ChatGPT desktop app (in-app browser) | ✅ | ✅ full coaching loop (2026-08-27) |
| Chrome 152 + flag (direct API / DevTools / in-page Inspector) | ✅ | ✅ |
| Codex Chrome extension side panel | ✅ (page text) | ❌ |
| Copilot in Edge | ✅ (page text) | ❌ |
| ChatGPT/Codex Chrome sidebar | ✅ (names the 12) | ❌ `tool_unavailable: not bridged into this runtime` |

The bridge companion (`bridge/`) exists precisely to close that column for any
MCP-speaking client. The gap is the ecosystem's; the fix is in this repo.

## Addendum 2026-08-29 — Host outage: ChatGPT app bundled-browser cache

Symptom: every conversation (Chat and Work mode) reported zero page tools on a page
whose own spike verdicts showed registration green. Agent-side error:
`Module not found: ~/.codex/plugins/cache/openai-bundled/browser/<ver>/skills/control-in-app-browser/scripts/browser-client.mjs`.

Root cause: a ChatGPT app plugin-bundle update (cached 2026-08-28 18:31) shipped
`browser-client.mjs` at the bundle's top-level `scripts/` while the skill loader
resolves it inside `skills/control-in-app-browser/scripts/`. The bridge never
initialized, so no conversation received any page's tools. Entirely host-side.

Repair: `ln -s ../../scripts` inside `skills/control-in-app-browser/`, fully quit
and relaunch the app. Verified end-to-end afterward: tool list returned with
schemas + origin, and `tools.call("spike_echo", {text:"ping"})` returned the
page nonce (`echo:ping nonce:mg-76`) — proof of real in-page execution.

Two host facts worth keeping:
- The runtime exposes page tools as a per-tab snapshot object invoked via
  `tools.call(name, input)`; a stale snapshot must be re-fetched. An agent
  calling `tools.<name>()` gets `is not a function` — agent error, not outage.
- Filming-day drill: if the coach claims no tools, open /spike.html first. Page
  verdicts green + agent sees none = check the plugin cache module path above.
