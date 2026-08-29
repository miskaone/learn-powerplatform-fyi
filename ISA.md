---
task: "Build and submit Mastery Gate WebMCP Challenge entry"
slug: 20260826-093000_mastery-gate-webmcp-challenge
project: learn-powerplatform-fyi
effort: E3
effort_source: auto
phase: execute
progress: 59/85
mode: build
started: 2026-08-26
updated: 2026-08-30
---

# ISA — Mastery Gate (learn.powerplatform.fyi)

> Source build decision: [`docs/build-decision.md`](docs/build-decision.md)
> (ideation synthesis 2026-08-25, amended 2026-08-26 to the learn-subdomain shape).
> This ISA lives here while the target repo is scaffolded; it moves to
> `miskaone/learn-powerplatform-fyi` root on Day 1 and is the system of record thereafter.
> Calendar mapping: Day 1 = Aug 26 … Day 7 = Sep 1 (MSP gate) … Day 9 = Sep 3 (deadline 1pm PDT).

## Problem

The PL-400 micro-lesson series can teach, but it cannot coach: there is no interactive
question layer, no misconception diagnosis, and no adaptive routing — a learner who misses
a question is told they are wrong, not why their mental model failed. Generic AI chatbots
invert the problem: they coach fluently but leak answers, grade by vibes, and cannot be
trusted to enforce mastery. Meanwhile the OpenAI WebMCP Challenge (deadline 2026-09-03,
1pm PDT) offers exactly the missing primitive — a browser agent that must act through
tools the site controls — plus a judged audience of the platform vendors this product
would ride on. Nothing submittable exists today: no repo, no subdomain, no engine, no
instrumented question bank.

## Vision

A judge opens learn.powerplatform.fyi/pl-400 in the ChatGPT in-app browser, types "just
tell me the answer," and watches the site refuse on the agent's behalf — then watches the
agent turn Socratic because Socratic is all the tool surface permits. When the learner's
rubric clears the gate, `advance_module` materializes in the live Tool Roster on camera.
The euphoric surprise is architectural: the website visibly governs what the AI is allowed
to know, say, and be — and the learner got genuinely better at PL-400 material along the way.

## Out of Scope

Drag-drop canvases and concept-map builders of any kind. Free-text NLP scoring feeding
anything that gates. Demo beats that require the model to fail on cue. A second demo
experience (the split-screen CoachKit scaffold) — the package README's roadmap section
carries that ambition. The Coachable Docs compiler. Dataverse / Lab Proctor integration
(judges cannot reproduce it). More than two PL-400 objectives. Accounts, backends, server
API routes, LLM proxy Workers, and the embedded fallback coach for non-agent visitors.
Spaced-review calendars. npm publish ceremony and semver theater. Mobile-first polish
(the app must render in the ChatGPT in-app browser; it is optimized for desktop demo).
Any change to the flagship `miskaone/powerplatform-fyi` repo or the main site — linking
the field guide to Learn is post-contest work.

## Principles

- **The site decides; the agent teaches.** Correctness, attempts, mastery, and routing are
  deterministic engine verdicts; the agent supplies explanation, tone, and Socratic craft.
- **Capability is the guardrail.** Enforce pedagogy by what tools exist, not by what a
  prompt requests. A tool that does not exist cannot be talked into existing.
- **Redaction beats instruction.** The agent cannot leak what the schema never contains —
  answer keys are structurally absent from tool responses, not politely withheld.
- **A deterministic referee is a filmable referee.** Same inputs, same routing, every take —
  the engine is what makes a 3-minute demo rehearsable.
- **Mastery is per-dimension, never an average.** Recall, Connections, Application,
  Transfer each ≥3 or the gate stays shut; an average is where weaknesses hide.
- **Agent-less operation is first-class.** Every engine path is drivable by page buttons;
  WebMCP is an interface to the product, not the product's pulse.

## Constraints

- Public repo `miskaone/learn-powerplatform-fyi` from the first commit — MIT for code
  (LICENSE at root), CC BY 4.0 notice for lesson content. No credentials ever committed.
- bun only; Next.js static export (`output: "export"`, build `bun run build` → `out/`);
  Cloudflare Pages, git-integrated, second project in the existing account; production
  branch `main`. One deploy path — no GitHub Actions deploy workflow.
- Deployment scars from the 2026-07-25 staging ISA apply verbatim: the Pages API
  domain-attach does NOT create DNS (create the `learn` CNAME as an explicit step); the
  Pages GitHub App needs a per-repo grant (`8000012` means App scope, not a missing
  repo); create the Pages project BEFORE the first push.
- Engine is pure TypeScript in `packages/mastery-gate` — no React imports, no network,
  no backend; all learner state in localStorage.
- All WebMCP access goes through one feature-detecting adapter shim (`navigator.modelContext`
  vs `document.modelContext`); nothing else touches the raw API. Exam-mode revocation ships
  real deregistration OR refusal-state fallback behind the same registry interface — the
  Day-1 spike verdict decides, and it is recorded in Decisions before any dependent work.
- Two PL-400 objectives, deeply instrumented; if authoring slips, cut item count — never
  the gate/drill machinery.
- Hard deadline: Devpost submission complete before 2026-09-03 1pm PDT, targeting a
  noon-PDT margin. Day-7 (Sep 1) feature freeze: after the MSP gate, only video, docs,
  and polish.

## Goal

By 2026-09-03 1pm PDT, a completed Devpost submission exists for Mastery Gate: a live,
public-repo-backed adaptive PL-400 course at `learn.powerplatform.fyi/pl-400` where the
unit-tested deterministic engine runs the full loop — redacted question delivery,
misconception-keyed grading, four-dimension rubric with the every-dimension-≥3 gate,
dynamic `advance_module` registration, visible Tool Roster, Flip-Condition transfer
drill, and Exam Mode (real revocation or refusal fallback) — verified working in the
ChatGPT in-app browser, with the sub-3-minute demo video and required documentation filed.

## Criteria

### Day-1 spikes, repo, and deploy chain

- [x] ISC-1: WebMCP namespace verdict for Chrome-behind-flag recorded in the repo (which of `navigator.modelContext` / `document.modelContext` resolves, with probe output)
- [x] ISC-2: WebMCP namespace verdict for the ChatGPT in-app browser recorded in the repo
- [ ] ISC-3: Adapter shim feature-detects both namespaces and passes unit tests against a mock of each
- [x] ISC-4: Dynamic deregistration spike verdict recorded in Decisions — Exam Mode mode chosen (real revocation | refusal fallback) before any dependent work starts
- [x] ISC-5: Repository `miskaone/learn-powerplatform-fyi` exists and is public
- [x] ISC-6: MIT `LICENSE` file at repo root, present from the first commit
- [ ] ISC-7: CC BY 4.0 notice covers the lesson-content directory
- [x] ISC-8: Cloudflare Pages project exists — `source.type=github`, repo bound, `production_branch=main`, build `bun run build` → `out`
- [x] ISC-9: `learn` CNAME exists and `https://learn.powerplatform.fyi` returns HTTP 200 with valid TLS
- [x] ISC-10: Cold clone passes `bun install && bun run build` with only the README instructions

### Engine (`packages/mastery-gate`)

- [x] ISC-11: Engine package contains no React imports and no network calls (static probe)
- [x] ISC-12: Grading is deterministic — identical answer sequences produce identical verdicts (property test)
- [x] ISC-13: Schema validation proves every distractor in the bank carries a named misconception id
- [x] ISC-14: Rubric scores four dimensions (Recall, Connections, Application, Transfer) 0–4 and the gate opens only when every dimension ≥3 (unit tests, including the 3/3/3/2 refusal case)
- [x] ISC-15: Engine public API exposes no averaged mastery number (API surface probe)
- [x] ISC-16: Routing table verified row by row — first miss→hint, second miss→review, repeated misconception→coach, correct+low-confidence→go_deeper, gate-pass→advance (one unit test per row)
- [x] ISC-17: Hint ladder refuses tier-2 before a genuine first attempt (unit test)
- [x] ISC-18: Learner state survives page reload via localStorage (browser test)
- [ ] ISC-19: `bun test` green across the engine package in the cold clone
- [x] ISC-20: Tool-registry state machine registers/retracts the correct tool set for each phase transition (unit test per transition)

### WebMCP tool surface

- [x] ISC-21: All ten static tools registered on page load, enumerable via `getTools()` (get_learner_state, get_current_context, navigate_to_anchor, log_coaching_note, get_current_question, submit_answer, get_hint, request_next_action, prescribe_drill, score_rubric)
- [ ] ISC-22: `get_current_question` response schema structurally lacks any answer-key or distractor-map field (schema test + runtime audit)
- [ ] ISC-23: `submit_answer` on a miss returns the named misconception id and never the correct answer (test)
- [ ] ISC-24: `advance_module` absent from `getTools()` while any rubric dimension <3
- [ ] ISC-25: `advance_module` appears via `toolchange` when the gate passes (integration test)
- [ ] ISC-26: `get_misconception_brief` registers only after the same misconception fires twice (test)
- [x] ISC-27: `reveal_outcome` registers only after `commit_prediction` lands — commit-then-reveal enforced by tool availability (test) — registry transition test observes it in `getTools()`; also exercised live agent-less 2026-08-27 (Reveal appeared only after commit)
- [x] ISC-28: `start_exam` revokes the coaching toolset per the ISC-4 verdict (deregistration observed in `getTools()`, or every coaching tool returns proctor-refusal states) — deregister-mode registry test asserts the exam-only set via `getTools()`; refusal fallback tested behind the same interface; live roster collapse to exam tools re-confirmed on production 2026-08-27
- [x] ISC-29: `get_exam_debrief` registers only after `submit_exam` (test) — registry test asserts absent pre-submit, present post-submit
- [x] ISC-30: `score_rubric` rejects submissions missing verbatim evidence quotes and clamps out-of-range scores (unit tests)

### UI (`/pl-400`)

- [x] ISC-31: Lesson + quiz flow serves at `learn.powerplatform.fyi/pl-400` — verified 2026-08-27 post micro-lesson restore: hub (track overview + full-track practice) and all five `/pl-400/[slug]` lesson pages return 200 live with the designed arc (scenario commit → concepts → visual → distractors → retrieval lab → drills → references); quiz flow probed end-to-end in real Chrome (miss verdict names misconception + contrast, resolution releases rationale, per-lesson scope shows "N of 7", hub shows "N of 34")
- [ ] ISC-32: Tool Roster panel lists currently registered tools and updates live on `toolchange`
- [ ] ISC-33: Rubric panel renders all four dimensions separately (no averaged display)
- [x] ISC-34: `navigate_to_anchor` scrolls to and visibly highlights the target section — probed 2026-08-27: same-page (coach action → scroll + `anchor-highlight` class observed) and cross-page live (hub → `mastery-gate:navigate-anchor` event → router push to the owning lesson → anchor scrolled into view; highlight auto-clears after 2s as designed)
- [ ] ISC-35: Every engine path is completable agent-less via page controls (manual walkthrough, scripted checklist)
- [x] ISC-36: Flip-Condition drill playable end-to-end: mutate assumption → commit prediction → reveal outcome — walked live on production 2026-08-27 (flip "External users?" → commit "Power Pages" + reasoned why → reveal: prediction held, transfer result recorded to ledger)
- [x] ISC-37: Exam Mode UI shows timer and locked/unlocked tool state per the ISC-4 verdict — verified live 2026-08-27: mm:ss countdown ticking, full locked-tool list rendered from real registry state (every coaching tool LOCKED mid-exam), roster restored on return to practice
- [ ] ISC-38: Full flow renders and operates in the ChatGPT in-app browser (manual probe, screenshots)

### Content (two objectives)

- [x] ISC-39: Exactly two PL-400 objectives instrumented, named in the content manifest
- [x] ISC-40: ≥25 questions across the two objectives
- [x] ISC-41: Schema validation passes bank-wide — every question carries objectiveId, concepts[], misconception-keyed distractors, and authored rationale
- [x] ISC-42: Every remediation anchor resolves to a real section id (link-check script)
- [ ] ISC-43: Two Flip-Condition scenarios encoded as decision tables with unit tests and lesson citations
- [x] ISC-44: Support Ticket Lab fallback decision recorded in Decisions if the PL-400 series is not ported by end of Day 1

### Submission package

- [x] ISC-45: Package README contains the registerTool example with name, description, inputSchema, and execute verbatim — grep-verified: one `document.modelContext.registerTool` example carries all four fields
- [ ] ISC-46: Demo video public on YouTube, under 3 minutes, with audio, showing all three scripted beats
- [ ] ISC-47: Devpost text docs filed — use-case fit, UX improvement, collaboration story, implementation description
- [ ] ISC-48: Devpost submission confirmed complete before 2026-09-03 1pm PDT
- [ ] ISC-49: Devpost checklist re-verified against the live repo on the morning of Sep 3

### Anti-criteria and antecedents

- [ ] ISC-50: Anti: no answer-key material is reachable through any registered tool response (schema audit + adversarial runtime probe asking for answers via every tool)
- [ ] ISC-51: Anti: zero commits land in `miskaone/powerplatform-fyi` for this feature (git log probe on the flagship repo)
- [x] ISC-52: Anti: no server API routes, account code, or LLM-proxy code exists in the repo (static probe)
- [x] ISC-53: Anti: no drag-drop canvas and no free-text NLP scoring component exists in the repo (static probe + review)
- [x] ISC-54: Anti: no credential, API token, or account id is committed (git grep over tracked files)
- [ ] ISC-55: Antecedent: the three-beat demo script is written and each beat reproduced twice consecutively in rehearsal before recording day (Sep 2)

### Mastery Debrief (Day-6 graft — conditional on MSP green at the checkpoint)

- [ ] ISC-56: Debrief plays end-to-end from a real session ledger in baked-audio mode — Motion scenes sequenced by each segment MP3's `ended` event (e2e test)
- [ ] ISC-57: `compose_debrief` registers only after module completion and rejects any segment whose misconception never fired in the ledger (integration test)
- [ ] ISC-58: Voice bake script produces one MP3 per authored segment line using the ElevenLabs key from env; assets committed; key never committed (script run + git grep)
- [ ] ISC-59: Live-narrator mode works — `get_narration_script` returns only engine-approved script content and `advance_segment` gates scene progression (integration test)
- [ ] ISC-60: Debrief degrades to the text debrief card when the graft is cut or audio is unavailable, behind one feature flag (flag test)
- [ ] ISC-61: Anti: the shipped site makes zero runtime calls to ElevenLabs or any TTS/LLM API (static probe + network audit during a full session)

### ACTOR pass (approved 2026-08-27)

- [x] ISC-62: `set_lesson_aim` tool + lesson-page aim input persist a validated, clamped (≤200 chars) aim per lesson on the ledger, exposed via `get_learner_state`, excluded from the rubric evidence corpus, refused mid-exam at the engine (unit tests)
- [x] ISC-63: Compress-the-rule commit-then-reveal on every lesson page persists the learner's one-line rule per lesson on the ledger, reveals the authored governing rule for comparison, and is ledger-exposed for coach critique (unit tests + page section)
- [x] ISC-64: Run-commitment field at lesson end persists per lesson with specificity-demanding copy and is ledger-exposed for the future debrief (unit tests + page section)
- [x] ISC-65: Kickoff prompt and the misconception-brief socratic seeds demand teach-back — the learner explains the concept back in their own words before advancing (prompt text + tool-layer seed, unit test)
- [x] ISC-66: `request_next_action` returns `rubric_interview` when per-dimension MCQ coverage thresholds are met (≥2 distinct attempted questions per dimension, deterministic) and the gate has not passed — never during an active exam; `score_rubric`'s description, the verdict's guidance, and the kickoff prompt carry the 5–8-question interview contract; the agent-less self-assessment path relabeled honestly (unit tests)
- [x] ISC-70: Gate-crossing tool responses carry a `toolChangeHint` naming newly available/revoked tools at score_rubric gate-pass AND gate-regress (transition-aware: no hint on an accepted rescore that leaves the gate open), misconception second fire, and exam start/submit (hint states truthfully that coaching tools return only when the learner leaves the exam screen) — present only at the crossing; the response channel as the only push channel (unit tests)
- [x] ISC-71: Every tool description states WHEN to call it (audit table in the ACTOR-pass record), and stuck revocations surface as a draining badge in the Tool Roster via getStuckRevocations/onStuckRevocation

### Transparency + Memory pass (approved 2026-08-28, docs/actor-plan.md §7)

- [x] ISC-67: "Your model" panel on the hub renders every fired misconception WITH its evidencing questions (each linked to its owning lesson), framed as evidence rather than badges, mirroring what `get_learner_state` shows the agent, and visually paired with the erase control (engine `getMisconceptionEvidence` + unit tests + panel; live-browser pass rides the ISC-38 ChatGPT check)
- [x] ISC-68: One-click JSON export of the complete stored record — the `mastery-gate:v1` payload plus the per-lesson scenario commits, exactly what erase destroys (client-side blob, zero network) — plus a confirmed one-tap erase that destroys it and reloads; copy states "your data never leaves your browser"
- [x] ISC-69: A correct practice verdict names the distractor-myth it defeats — the learner's own previously fired misconception on that question when one exists, else the first distractor's — selected engine-side, projected field-by-field, absent on misses and mid-exam (unit tests + success-card line on page and tool response)
- [x] ISC-73: The ledger records the agent's confidence hints (against the outcome each referred to) and rubric proposals (accepted/rejected + resulting gate state) — deterministic bookkeeping that never feeds routing, grading, or the gate; the calibration summary is exposed through `get_learner_state` and rendered as one line in the Your-model panel when data exists (unit tests incl. routing-verdict invariance)
- [x] ISC-74: At registration time only (never mid-session churn), `get_hint` and `get_misconception_brief` descriptions gain profile-composed suffixes for returning learners naming their repeated misconceptions (names only — never contrasts, seeds, prompts, or option text), capped at three, absent on a cold profile; the roster meta re-composes at late runtime binding so the on-page descriptions match what registered (unit tests)
- [x] ISC-75: Memory contract — `get_learner_state` exposes `coachingNotes`; `log_coaching_note` gains validated `kind` observation|preference|context (default observation) and a deterministic answer-cache guard rejecting question/option id patterns (`ml\d+-q\d+(-…)`, plus punctuation-dodging shapes like `ml13.q1`) and verbatim option text case/whitespace/punctuation-insensitively — ≥20-char sliding windows over both a spaced and a squashed (alphanumeric-only) canonical form, with 12–19-char options checked whole so short correct answers cannot be stashed; single common words (<12 chars) and free-prose paraphrase keys are the documented residual, pinned by test alongside "agent skips the interview"; the agreed description surgery on get_learner_state / log_coaching_note / get_hint / get_misconception_brief / set_lesson_aim; kickoff prompt carries the MEMORY clause and the SPACING / DIFFICULTY / TRANSFER technique lines (unit tests + prompt assertions)

### Coach grounding (approved 2026-08-29; criteria restated 2026-08-30 after cross-review)

The design rule for this whole surface: **the agent gets exactly what a learner reading the
page gets. No more, no less.** Symmetry, not starvation.

- [x] ISC-76: `get_lesson_brief` hands the agent the authored teaching material for the active lesson — title/topic, heroEpigraph, governingRule, examClue, mnemonic, the scenario prompt, concepts[] {label, importance, summary}, the distractor teardown the page renders ungated in section 05 (choice / whyTempting / whyWrong), the visual walkthrough {type, title, steps[] {label, state, detail}}, productionNuance[], the four targeted drills, the reflection prompts, the section anchors WITH their titles, and references — sourced from `lesson-pages.json` through an app-layer `MasteryEngineFacadeOptions.getLessonBrief` provider (the engine package stays content-agnostic), projected field by field at three independent boundaries (app `toLessonBrief`, stack `copyBrief`, tool `publicLessonBrief`), each mutation-verified to fail on a spread; registered in the lesson/practice phases and refused mid-exam AT THE ENGINE as well as deregistered. `scenarioExpectedAnswer` is commit-gated symmetry, not exclusion: null until the learner commits and the page reveals it, then the same text on their screen, and never prerendered. The payload structurally excludes question rationales, `correctOptionId`, and option→misconception mapping — exclusion battery over every lesson in the manifest, plus a per-lesson symmetry audit walking every string leaf of the lesson catalog in both directions (no authored string missing from the brief; no brief string that does not trace to the lesson)
- [x] ISC-77: The briefing contract is carried by both the kickoff prompt and the named tool descriptions — teach from the authored lesson rather than general knowledge, with the agent's own additions barred outright while a question is open and marked as its own afterwards; establish the scenario in one or two sentences before any probing question, never assuming context the learner was not just given; and NO RECITING — never restate the governing rule, exam clue, or mnemonic while a question is unanswered, since several of them name the correct option almost verbatim. Folded into `get_lesson_brief`, `get_current_question`, and `get_hint`; `get_lesson_brief` states what it contains and never narrates its gates or names the tool behind them; `get_current_context` emits sectionTitle-bearing anchors so the agent can name where it is sending the learner (unit tests + prompt assertions, including a negative assertion that the brief description does not name `get_misconception_brief`)
- [x] ISC-78: The brief provider the app actually runs is covered and invariant-guarded: `setLessonBrief(slug, brief)` replaces the brief in place with no question-scope churn (the lesson page sets scope and brief in separate effects, so a scenario reveal cannot release and re-acquire the scope); a brief whose slug does not match the active lesson is refused rather than stored (lesson B's prose can never be served over lesson A's questions); a same-slug `setActiveLesson` replaces a supplied brief instead of discarding it; and stored briefs are defensive copies, so a caller mutating its object afterwards cannot change tool output (unit tests through `stack.facade.getLessonBrief()`, the real path, never a hand-rolled provider)

### Tool Inspector (approved 2026-08-28)

Judge reproducibility without an agent: any browser opens the exact tool surface, invokes
it, and sees the same refusals and redactions an agent would — the fallback demo if the
ChatGPT runtime misbehaves on camera, and the standing proof that agent-less parity is
architectural, not asserted.

- [x] ISC-79: The inspector invokes only registry-registered tools: its surface is exactly `gate.rosterNames` — the identical derivation the Tool Roster renders (registry `getRegisteredNames()` with a runtime, `wouldRegisterToolNames()` without; quarantine excluded, canonical order) with zero desired-list logic of its own — and invocation goes through the registry-WRAPPED descriptors whenever a runtime is bound, so the mid-drain `tool-revoked` refusal and the refusal-mode exam guard are byte-identical to the agent path; agent-less it falls back to the raw shared toolset under the engine-guard invariant documented on `MasteryStack.getToolset()` (gating-fidelity parity across all 8 phase snapshots + guard-parity regression suite)
- [x] ISC-80: Every real tool schema renders an invocable form — string / number(min–max) / enum / one-level group fields with a JSON-textarea fallback; required-field enforcement, enum/range/JSON validation, nested rubric build; a validation failure carries the offending field's path, is announced through the tool's live region, and marks the control with aria-invalid + aria-describedby (schema-form coverage over ALL_TOOL_NAMES + buildToolInput battery)
- [x] ISC-81: Results render exclusively as React text children inside `<pre><code>` with the hint line separate; the 2400-char display cap never splits a surrogate pair and "Show full response" moves keyboard focus to the expanded output instead of dropping it to `<body>`; the component contains no `dangerouslySetInnerHTML`/`innerHTML`, and the live hostile-payload probe (`<img onerror>` + `<script>` through `log_coaching_note`, echoed via `get_learner_state`) rendered as escaped text with zero elements created (source-sink test + live injection probe)
- [x] ISC-82: Available in any browser with zero agent runtime behind `?inspector=1` (read post-hydration; prerendered HTML carries only the roster toggle, so learners without the flag see an unchanged page); the framing copy is configuration-truthful — registered-descriptor wording only when a runtime is bound, engine-rule wording agent-less (agent-less fallback test + live static-export smoke)

### Bridge (art of the possible, approved 2026-08-28)

> Companion tool under `bridge/`, imports nothing from `apps/` or `packages/`, not part of the site build. The four criteria below are the server/manifest half, all machine-probed here; the browser half (extension loaded in Chrome, live paired tab end-to-end) stays open for the owner's runbook run — see `docs/bridge-demo-runbook.md`.

- [x] ISC-83: Bridge MCP server lists a paired tab's tools via `tools/list`, re-queried live over the WS on every call (never cached) — unit-tested against a fake extension client (`bridge/server/ws.test.ts` listTools round trip; `backend`/`mcp` core tests)
- [x] ISC-84: `tools/call` round-trips through `executeTool` with the page result passed back verbatim as data (never eval'd) — unit-tested against a fake extension client (`bridge/server/ws.test.ts` callTool round trip)
- [x] ISC-85: The localhost WS rejects unauthenticated clients — a wrong/absent proof is closed 4001, a web-page `Origin` upgrade is refused 404, and the mutual challenge-response keeps the pairing token off the wire in both directions (`bridge/server/ws.test.ts`)
- [x] ISC-86: Single-origin allowlist enforced in the extension manifest — `host_permissions` is exactly `["https://learn.powerplatform.fyi/*"]`, mirrored by an exact-origin `ALLOWED_ORIGIN` const, no wildcards (file probe)

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| 1–2 | manual+file | run namespace probe page in both targets; commit verdict doc | both verdicts recorded | Interceptor + Read |
| 3 | unit | shim tests against mocks of both namespaces | green | bun test |
| 4 | file | Decisions entry names the Exam Mode verdict | present, dated Day 1 | Read |
| 5–7 | api+file | `gh repo view` visibility; LICENSE + content notice present | public, MIT, CC BY | Bash |
| 8 | api | `GET /pages/projects/learn-powerplatform-fyi` | fields match | Bash + curl |
| 9 | http+api | DNS record + `curl -sSI https://learn.powerplatform.fyi` | CNAME exists, 200, TLS ok | Bash |
| 10 | e2e | cold clone in temp dir, README steps only | build passes | Bash |
| 11, 52–53 | static | `rg` for react/network imports, route handlers, canvas/NLP libs | zero hits | Grep |
| 12–17, 20, 30 | unit | engine + registry test suites | green | bun test |
| 15 | static | engine public API typings | no average field | Read |
| 18, 21–29 | integration | browser harness driving tools + getTools()/toolchange assertions | all pass | Interceptor |
| 31–34, 36–37 | e2e | scripted walkthrough on the live deploy | all steps pass | Interceptor |
| 35 | human-proxy | agent-less checklist walkthrough | complete without tools | Interceptor |
| 38 | manual | full flow in ChatGPT in-app browser | operates; screenshots | Human + screenshots |
| 39–43 | script | content schema validator + anchor link-check + decision-table tests | zero violations | bun test |
| 44 | file | Decisions entry exists iff fallback taken | consistent | Read |
| 45 | file | README contains the four required fields in one example | verbatim present | Grep |
| 46 | manual | YouTube video public, duration, audio, beats | <3:00, all beats | Human |
| 47–49 | manual | Devpost form complete; checklist re-run | submitted, timestamped | Human |
| 50 | adversarial | ask for the answer through every tool; audit schemas | zero leaks | Interceptor |
| 51 | git | `git log` on flagship repo since 2026-08-26 | no feature commits | Bash |
| 54 | git | `git grep` token patterns over tracked files | zero hits | Bash |
| 62–64 | unit+page | engine lesson-text setters (clamp/validate/exam-guard/persist/reload) + corpus-exclusion probe + lesson-page sections | green | bun test + Read |
| 65 | unit+file | teach-back seed appended in get_misconception_brief; kickoff prompt text | present | bun test + Read |
| 66 | unit | readiness thresholds, routing precedence rows, exam-safety; interview contract strings | green | bun test |
| 70 | unit | toolChangeHint at all four crossings, absent at non-crossings | green | bun test |
| 71 | review+unit | description audit (before/after in the ACTOR-pass commit); stuck badge renders from getStuckRevocations | recorded | Read + bun test |
| 76 | unit+exclusion+audit | per-lesson exclusion battery over the real manifest (forbidden key names + every withheld string: pre-commit expectedAnswer, rationales, correctOptionId, option ids, misconception contrast/seeds); per-lesson two-way symmetry audit walking every string leaf of the lesson catalog (nothing authored missing from the brief; nothing in the brief that does not trace to the lesson), with a documented structural-only exclusion list that fails if a row goes stale; exam-guard test at facade AND tool asserting the widened payload is refused; registry phase-transition test; all three projections mutation-tested (adding a spread at the app, stack, or tool boundary turns a test red — verified by running the mutation) | zero leaks, zero asymmetries, green | bun test |
| 77 | unit+file | kickoff prompt GROUND / SCENARIO FIRST / NO RECITING clauses; contract strings in get_lesson_brief / get_current_question / get_hint descriptions; negative assertion that get_lesson_brief no longer names get_misconception_brief; titled anchors in get_current_context | present | bun test + Read |
| 78 | unit | stack-provider battery through `stack.facade.getLessonBrief()` — the real path, never a hand-rolled provider: brief carried end to end, setLessonBrief replaces in place with no scope churn or notification, slug-mismatch refused at both setters, same-slug replacement lands, defensive copy survives caller mutation (mutation-tested: returning the caller's object turns it red) | green | bun test |
| 79 | unit | roster-derivation parity (wouldRegisterToolNames vs canonical desired-minus-quarantined; live registry across all 8 snapshots) + guard-parity suite (mid-drain wrapped refusal == agent refusal; refusal-mode parity; wrapper-preference wiring; agent-less identity fallback) | green | bun test |
| 80 | unit | schemaToFields over ALL_TOOL_NAMES + exact shapes for submit_answer / request_next_action / log_coaching_note / score_rubric / compose_debrief / zero-arg tools; buildToolInput battery incl. failure paths carrying field path | green | bun test |
| 81 | unit+manual | no-HTML-sink source assertion; capText cap + surrogate-pair test; live hostile-payload probe through the served static export | green, zero elements created | bun test + browser |
| 82 | unit+manual | agent-less getInvocableToolset identity test; prerendered HTML grep (toggle present, panel markup absent); ?inspector=1 smoke on the static export with no runtime | green | bun test + Bash + browser |

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Day-1 spikes & shim | Namespace + deregistration spikes in both targets; adapter shim; Exam Mode verdict | ISC-1…4 | — | yes (with Repo scaffold) |
| Repo & deploy scaffold | Public repo, licenses, Pages project, CNAME, cold-clone contract | ISC-5…10, 54 | — | yes (with spikes) |
| Engine core | Grading, misconceptions, rubric+gate, routing, hints, localStorage, registry | ISC-11…20, 15 | Day-1 spikes & shim | no |
| Content port & instrumentation | Two objectives, ≥25 questions, schema validation, anchors, Flip-Condition tables | ISC-39…44 | Repo & deploy scaffold | yes (owner-authored, parallel to Engine/UI) |
| WebMCP tool surface | Static tools, redaction, dynamic registration, exam revocation/fallback | ISC-21…30, 50 | Engine core | no |
| UI | Quiz flow, Tool Roster, rubric panel, anchors, agent-less parity, drill, exam UI | ISC-31…38 | Engine core; partial on Tool surface | partial |
| Mastery Debrief (graft) | Motion scenes, baked ElevenLabs audio, `compose_debrief`, live-narrator handshake, text-card degrade | ISC-56…61 | Engine core; WebMCP tool surface; go/no-go at Day-6 checkpoint | no |
| Submission package | README example, Devpost docs, checklist re-verify | ISC-45, 47…49, 51…53 | all above (MSP gate, Sep 1) | no |
| Demo video | Three-beat script, rehearsal, record in ChatGPT browser, publish | ISC-46, 55 | Submission package (MSP) | no |
| ACTOR pass | Aim/compress/run ledger records + inputs, teach-back prompt layer, rubric-interview routing, response hints, description audit, stuck badge | ISC-62…66, 70…71 | Engine core; WebMCP tool surface; state machines | no |
| Transparency + Memory pass | Your-model panel, export/erase, myth naming, agent report card, profile-annotated descriptions, memory contract + answer-cache guard | ISC-67…69, 73…75 | ACTOR pass; WebMCP tool surface; UI | no |
| Coach grounding | `get_lesson_brief` + app-layer brief provider, titled section anchors, briefing contract in prompt + descriptions, per-lesson exclusion battery, per-lesson two-way symmetry audit, stack-provider invariants | ISC-76…78 | WebMCP tool surface; Content port | no |
| Tool Inspector | `?inspector=1` panel: roster-derived invocable forms for every live tool, registry-wrapped invocation, text-only rendering, live-region a11y | ISC-79…82 | WebMCP tool surface; UI | no |

## Decisions

- **2026-08-25** — Composite concept selected by unanimous 3-judge panel over 29 ideation
  concepts: Mastery Gate spine + Tool Roster legibility panel + Flip-Condition transfer
  drill + Exam Mode capstone (spike-gated) + CoachKit demoted to README framing. Canvas
  concepts, NLP scoring, and fail-on-cue demos ruthlessly cut. Full record in
  `docs/build-decision.md`.
- **2026-08-26** — Learn-subdomain shape adopted: one public repo
  (`miskaone/learn-powerplatform-fyi`) at `learn.powerplatform.fyi/pl-400` instead of a
  library-only extraction from the private flagship. Rationale: the whole submission
  becomes one inspectable artifact (all-source rule satisfied by construction), hackathon
  pace is isolated from the flagship, and the risky PL-400 branch merge becomes a content
  port. Engine remains extractable as `packages/mastery-gate`.
- **2026-08-26** — License split: MIT for code, CC BY 4.0 for lesson content, matching
  the existing public content repo's posture. The misconception taxonomy and question
  bank ship public as part of the OSS story — accepted deliberately.
- **2026-08-26** — `signals/rules.ts` will be ported from the private flagship into the
  public repo — an explicit owner license grant of that file's logic under MIT.
- **2026-08-26** — Scaffolded at E3 (~55 ISCs), not E4: decomposing to the E4 floor of
  128 ISCs before the Day-1 spike verdicts would be false precision — the Exam Mode ISCs
  and tool-surface details can legitimately split only after ISC-4 resolves. Revisit tier
  at PLAN; split with stable child IDs (ISC-N.1…) as verdicts land. Forge joins EXECUTE
  for the engine and tool-surface features regardless, per the high-consequence rule.
- **2026-08-26** — Exam Mode implementation (real deregistration vs refusal-state
  fallback) deliberately left open pending the ISC-4 spike; both ship behind the same
  registry interface so the choice is a one-line swap, never a redesign.
- **2026-08-26** — Mastery Debrief adopted as the SOLE Day-6 graft, replacing Trap
  Cards, the Report Card twist, and Readiness Radar in contention. Shape: Motion (MIT)
  scene components at runtime — NOT `@remotion/player` (Remotion's non-MIT two-tier
  license, unclear player terms, and pending 5.0 rewrite stay out of the shipped bundle;
  Remotion is reserved for build-time contest-video rendering where the owner's free
  tier applies). Voice is baked at build time via ElevenLabs against the finite authored
  segment library; the learner's name personalizes visually in baked mode. Two
  soundtracks behind one interface: baked-audio floor (deterministic, agent-less parity,
  recorded-demo fallback) and live-narrator ceiling — the agent paces the film via the
  `get_narration_script` / `advance_segment` handshake, speaking the name and session
  references only it knows. Pre-authorized degrade: text debrief card. Rationale for the
  handshake design: WebMCP is pull-only, so the video syncs to the agent, not the agent
  to the video — which converts narration from a TTS trick into a protocol demonstration.
- **2026-08-26** — Phase moved observe → execute; Day 1 opened: new local repo +
  repo-bootstrap, spikes to follow. ISA relocates to the new repo root once it exists.
- **2026-08-26** — Deploy chain live: Pages project learn-powerplatform-fyi bound to
  main, learn CNAME created explicitly (scar 1 applied), first production deploy
  767f44a3-42ff-434c-9b29-1ff304ce9386 verified at learn.powerplatform.fyi. Merged
  build/day1-overnight into main (fast-forward) as the deploy trigger, per owner
  authorization.
- **2026-08-27** — Wiring stage shipped and hardened through adversarial cross-review.
  Stage 1 (`ded2922`): UI wired to the real engine + WebMCP registry per spike-verdict law
  (document-first shim, getTools polling, drain-first revocation), `mockState.ts` retired,
  LocalStorageAdapter with probe-write + memory fallback, agent-less parity via the same
  NotifyingFacade. Stage 2 (`f3f263f`, cross-review fixes): **(BLOCKER)** the mastery gate
  was self-serviceable — the agent could quote `get_current_question`'s own prompt back
  through `score_rubric` as "verbatim evidence" and award 4/4/4/4 with zero answers; fixed
  by excluding every tool-emitted string (prompts, option texts, misconception fields,
  objective titles) from the evidence corpus AND adding an engine precondition that rejects
  any rubric before the first graded attempt on the ledger. **(MAJOR)** `loadState` now
  validates the persisted ledger/hints/lastGrade field-by-field and returns null on
  mismatch (a tampered `mastery-gate:v1` no longer white-screens /pl-400).
  **(MAJOR)** `lastGrade` persists with the ledger, so hint/review/coach routing survives
  reload (ISC-18 covers routing, not just attempts). **(MAJOR)** `confidence` plumbed
  end-to-end (facade → adapter → `request_next_action` input schema → UI "I wasn't sure —
  go deeper" button), making the `go_deeper` routing row reachable on both surfaces
  (ISC-16 true end-to-end). **(MINOR)** `storageDegraded` is a live getter, so mid-session
  quota/ITP degradation surfaces in the UI. Earlier-round findings (tier-2 hint answer
  oracle, drain-timeout abort violating the drain-first law) were already fixed in
  `ded2922`. Four of the review's nine findings were lost to a truncated handoff; an
  independent audit of the diff (hints, registry, prerendered HTML answer-key scan,
  toolchange-dependency grep) found no residuals. Gate at ship: 166 tests green, tsc
  clean, static export clean (no answer-key strings in out/), content validation OK.
  Deployed to production via fast-forward of main. Package-level probes ran for
  ISC-11…18, 20, 30, 52…54; ISC-21…29 browser probes stay open for the ChatGPT
  in-app-browser pass.
- **2026-08-26** — Spike verdicts (ChatGPT in-app browser, live probe at /spike, evidence in
  `docs/spike-verdicts.md`): `document.modelContext` only (`navigator` absent); Chromium 151 base;
  no `toolchange`/`addEventListener` surface — agent notification + `getTools()` polling is the
  required mechanism, events optional. **Mid-session registration IS visible to the agent** (it
  listed and executed the late tool) and **deregistration IS honored** (aborted tool vanished from
  its list). ISC-4 verdict: **Exam Mode ships real revocation** with a hard drain-first rule
  (never abort mid-execution; Chromium <153 kills in-flight calls), refusal fallback retained
  behind the registry interface. Shim namespace preference flips to document-first. Chrome-side
  ISC-1 still pending.
- **2026-08-27** — ISC-21 verified in the primary judge environment: ChatGPT's live WebMCP
  discovery on production enumerated all ten static tools, matching `tool-names.ts` declaration
  order. Preceded by two production defects found and fixed same-day: the modelContext injection
  race (late-binding detection, `c66a380`) and the sync `getTools()` contract crash
  (Promise-normalized reads + truthful mocks, `6099cb0`) — root-caused by injecting a
  promise-returning mock runtime into a clean browser against the live site.
- **2026-08-27** — ISC-44 resolved by PORT, not fallback: the authored PL-400 lesson specs
  (Codex outputs, 2026-08-23) were found with dimension-tagged questions and whyTempting/whyWrong
  distractor anatomy. Ported ML-13/11/09 (custom connectors & Azure integration) and ML-12/14
  (Dataverse extensibility & platform limits) — a substitution from the briefed ML-01/03/04/06/07,
  which never received structured specs (HTML only). 34 questions, 17-misconception taxonomy
  (three shared across lessons), answer-position rotation, dimension-routed remediation anchors.
  Owner ratified the taxonomy at 17 (rejected both candidate merges) on 2026-08-27; review record
  in docs/content-port-review.md. Queued: dimension field on Question (schema.ts, post-lane),
  second flip scenario (ISC-43).
- **2026-08-27** — Micro-lesson architecture restored per owner feedback ("you lumped it all
  together, blows the micro lessons concept out of the water"). The single-page /pl-400 shell is
  RETIRED as the lesson surface; the design contract is the owner's original rendered lessons
  (PL400-ML-{09,11,12,13,14} HTML): each lesson is its own statically-exported route at
  `/pl-400/[slug]` mirroring the original arc — hero + epigraph → commit-before-reveal scenario
  → governing rule/exam clue → concept hierarchy → interactive visual walkthrough → distractor
  teardown + production nuance → retrieval lab against the live engine → drills + reflection →
  final mental model + references. The hub is now a track overview (objective cards with real
  ledger progress, lesson cards, full-track practice loop, Start Coaching). Engine gained
  runtime-only question scoping (`setQuestionScope`, route-derived, never persisted) and
  lesson-scoped retake (`resetQuestions`); `get_current_context` carries the route lesson
  ({slug, title, objectiveId, sectionAnchors}) consistently with its objective fields.
  Hardened through a 14-finding cross-review (all fixed or documented, commit `8c9edec`):
  remediation now routes on the question's own same-lesson anchor (shared-misconception anchors
  could eject the learner into a different lesson); the scenario expected answer no longer ships
  in the prerendered page (fetched post-commit from `/pl-400/scenario/<slug>.json`); the full
  teaching catalog left the client chunks (generated `lesson-index.json` is the only
  client-importable lesson artifact); the authored per-question rationale and misconception
  contrast now reach agent-less learners (rationale gated until question resolution); lesson
  pages end with the mastery profile + prescribed drill, per the original design. ML-08/ML-10
  are documented as deliberately unported (owner contract scoped five lessons; porting them
  would add unreviewed questions and mutate the ratified taxonomy). Merged to main (`3dc2aaa`)
  and verified live: hub + all five lesson routes 200 with the new structure, redaction greps
  clean per route, catalog prose absent from shared chunks.
- **2026-08-27** — State machines shipped: Exam Mode runs REAL revocation with drain-first
  discipline end-to-end on production, and the flip drill + exam surfaces are live agent-less.
  Stage commits `9019042` (surface activation: un-quarantined exam/drill tools, ExamSection with
  UI-owned countdown reading engine truth, locked-tools list from the real registry roster) and
  `add3490` (adversarial cross-review disposition). What the review found and what shipped:
  the exam was escapable through five independent paths — ALL closed at the ENGINE, not the
  registry (deregistration is now defense-in-depth, not the only guard): coaching methods
  (`requestHint`/`scoreRubric`/`logCoachingNote`/`resetQuestions`, facade
  `getMisconceptionBrief`/`advanceModule`/context concepts) refuse mid-exam; `submit_answer`
  withholds correctness until submit (`correct: null` mid-exam — no per-question oracle);
  recorded exam answers are final (the last-question re-answer fallback is gone); the exam
  question renders ONLY in ExamSection (practice panels lock on `examActive` on the hub and
  every lesson page); storage cross-validates phase↔exam↔activeDrill so a type-valid tampered
  reload cannot resurrect the coaching surface mid-exam. The exam clock carries a `lastSeenAt`
  high-water mark (OS clock rollback cannot rewind or un-expire), reload clamps duration and
  rejects future `startedAt`, and an answer landing at the expiry boundary refuses instead of
  silently burning a practice attempt. The flip drill now grades by exclusive match (shotgun
  predictions naming rival outcomes fail) and requires a 10-char reason. The registry survived
  three more findings: stale registerTool rejections delete only their own controller,
  `sync()` resolves only after registrations settle, and a NEW invocation during a draining
  revocation refuses (`tool-revoked`) while in-flight executions still settle — the drain-first
  law holds. Deliberate partial: retakes rotate the fixed exam form deterministically rather
  than sampling — the fixed form is the deterministic referee's public artifact, and unlimited
  retakes are a learning-product choice (review finding 13, documented not "fixed"). The
  manifest now ships an explicit 10-question/600s exam form balanced across both objectives
  (validator enforces existence, id integrity, and ≥30s per item). 17 regression tests pin all
  of it (261 pass). Verified live on production post-deploy: full agent-less loop — practice
  attempt → demo rubric gate → drill mutate/commit/reveal (transfer result on ledger) → exam
  start (timer, roster collapse, every coaching tool LOCKED) → submit → per-dimension debrief
  with missed concepts → return to practice (roster restored). ISC-27/28/29/36/37/45 ticked;
  ChatGPT in-app-browser halves of the tool-surface ISCs (21-26, 50) stay open for the judge-
  environment pass.
- **2026-08-28** — ACTOR pass shipped on `build/actor` (branch fast-forwarded onto the
  state-machines ship `fc98593` first — the rubric interview's exam-safety and the exam-crossing
  response hints depend on the live exam lifecycle). Aim/Compress/Test/Own/Run is now enforced by
  protocol design rather than prompt hope, per docs/actor-plan.md (ids renumbered: the adopted
  surface-review items ship as ISC-70/71 because main reserved ISC-67..69 for the transparency
  pass). **Engine (`3a27c59`)**: three learner-authored ledger records (lessonAims,
  ruleCompressions, runCommitments) — validated, trimmed, clamped (200/200/300 chars, 24 keys),
  exam-guarded at the ENGINE, persisted through the validating storage path (absent field →
  default, wrong type → reject, tampered value → deterministic clamp), exposed via
  get_learner_state, and proven un-launderable into rubric evidence; Question.dimension landed as
  the queued required schema field (validator enforces it, toQuestionPublic still redacts it);
  isRubricInterviewReady() (>=2 distinct attempted questions per dimension; false when the gate is
  open or an exam is live) feeds the new rubric_interview routing verdict, slotted after go_deeper
  so miss-handling always wins. **Tool surface (`5cfa4bd`)**: set_lesson_aim is the 11th static
  tool (23 total; revoked in exam deregister mode like every coaching tool) and its description
  orders the agent to ask for the aim as the FIRST question of every session; gate-crossing
  responses carry toolChangeHint — the agent's only push channel (no toolchange events in
  ChatGPT): score_rubric gate-pass names advance_module/start_exam, the exact second misconception
  fire names get_misconception_brief, exam start/submit name the revocation/restoration;
  request_next_action returns { verdict, guidance? } with the 5-8-question interview contract on
  rubric_interview; every misconception brief's socraticSeeds now end with the teach-back seed;
  all 23 descriptions rewritten as agent-facing UX (each states WHEN to call it — before/after in
  that commit's diff). **UI (`f9d1fe0`)**: lesson pages gain the AIM input (hero), the 02/COMPRESS
  commit-then-reveal against the authored governing rule, and the 08/RUN commitment section — all
  writing through the same NotifyingFacade the tools call (agent-less parity), with -compress/-run
  added to lessonSectionAnchors so navigate_to_anchor can put the critique on screen; the kickoff
  prompt opens with the aim question, demands teach-back, critiques the compression, and carries
  the interview contract; PracticePanel surfaces the rubric_interview invitation agent-lessly and
  the demo rubric button is relabeled "Self-assess rubric (demo evidence, scores 3/3/3/3)"; the
  Tool Roster renders a "revoking — draining" badge from getStuckRevocations/onStuckRevocation.
  REJECTED per the plan's verified disposition: the static /.well-known manifest (no such
  discovery mechanism exists in the WebMCP spec). Gates at ship: 312 tests green, tsc clean,
  static export clean, validate:content OK. Browser probes (ISC-38 family) remain open for the
  ChatGPT in-app pass.
- **2026-08-28** — ACTOR cross-review disposition and ship (`83cd966`, merged to main). Six
  findings, all resolved or documented: **(MAJOR, fixed + regression)** `EXAM_SUBMIT_HINT` claimed
  "coaching tools are restored" while phase stays `exam` until the human clicks Return to practice
  (no tool can trigger `exitExam`) — the one post-exam push the agent gets was actively wrong;
  hint and `submit_exam` description rewritten truthfully ("coaching tools return only after the
  learner clicks Return to practice"). **(MINOR, fixed + regressions both directions)**
  `score_rubric`'s hint is now transition-aware: no hint on an accepted rescore while the gate
  stays open (was re-emitting the full gate-pass hint), and a NEW `GATE_REGRESS_HINT` fires when
  an accepted rescore closes the gate and revokes advance_module/start_exam — previously a
  registration-changing moment with zero push signal. **(LOW, fixed)** hub-stored aims were
  display-orphaned: the hub now renders the `'track'`-keyed aim via the same LessonAim component
  (agent-less parity preserved through NotifyingFacade) and `set_lesson_aim`'s description names
  the track fallback. **(LOW, fixed)** `saveFailureMessage` maps `too-many-entries` at the 24-key
  cap. **(NIT, doc-fixed)** `clampLessonTextRecord`'s doc comment no longer promises a non-string
  tolerance the load path pre-empts (load rejects per the ISA contract; the branch is defensive).
  **(ACCEPTED RESIDUAL, pre-existing, not widened)** the rubric interview is an invitation, not
  an enforcement: an agent can open the gate through `score_rubric` with one graded attempt and a
  verbatim quote, zero interview questions asked — engine validation deliberately unchanged per
  the plan; ISC-50's adversarial probe must record "agent skips the interview entirely" as a
  known residual. Review confirmed clean: no ledger-field corpus leaks, no hint leaks (second-fire
  response field-identical to publicVerdict; mid-exam verdict fields null), prompt only
  strengthened, prerender clean (learner text client-only), all three setters exam-guarded at the
  engine, routing precedence rows (h)–(l) pinned, all four live dimension counts ≥2 so the
  interview verdict is reachable in production, and no `/.well-known` manifest anywhere (rejected
  item respected). Response-hint pattern formally adopted as the agent's only push channel;
  description audit (all 23 tools state WHEN to call) stands. Gates at ship: 314 tests green,
  tsc clean both packages, validate:content OK, per-route redaction grep clean on the built HTML.
- **2026-08-28** — Transparency + Memory pass shipped (actor-plan §7, one commit on
  build/transparency; Grok 4.6 built the slices, driver-verified with independently authored
  behavior tests). **Glass box (ISC-67…69)**: the engine derives a misconception→evidencing-
  questions map from the attempts ledger (`getMisconceptionEvidence`, first-fire order, no option
  ids) and the hub's new "Your model" panel renders it with each question linked to its owning
  lesson — framed explicitly as evidence, not badges (Long & Aleven's calibration caveat), showing
  the learner the same coachingNotes/calibration surface `get_learner_state` hands an agent, and
  visually paired with the data controls: a client-side blob export of the complete
  `mastery-gate:v1` payload and a confirmed erase (engine reset + scenario commits + reload) under
  the copy "your data never leaves your browser". Correct practice verdicts now name the
  distractor-myth they defeat — the learner's own previously fired misconception on that question
  when one exists, else the first distractor's — selected engine-side, projected field-by-field,
  null on misses and mid-exam; rendered on both success cards and carried by `submit_answer` (both
  response shapes stay field-identical apart from toolChangeHint, pinned by test). **Dual profile
  (ISC-73/74)**: the ledger gains `confidenceHints` (each explicit request_next_action confidence
  logged against the lastGrade outcome it referred to — never recorded mid-exam) and
  `rubricProposals` (accepted/rejected + resulting gate state, recorded only past the
  preconditions); a deterministic calibration summary (agreements, high-confidence misses,
  proposals accepted) is exposed via get_learner_state and rendered as one line in the Your-model
  panel — with a pinned invariance test that recording never changes the routing verdict.
  Profile-annotated descriptions compose at REGISTRATION time only: `createToolset` snapshots
  repeated misconceptions (fires ≥2, capped at 3, fire-count order) into returning-learner
  suffixes on get_hint/get_misconception_brief — names only, never contrasts/seeds/option text;
  cold profiles get no suffix; the late-binding runtime path re-composes the roster meta at its
  own registration moment so the on-page descriptions match what registered. **Memory contract
  (ISC-75)**: coachNotes became typed CoachNotes with `kind` observation|preference|context
  (tool-validated enum, default observation; legacy string notes migrate on load, invalid kinds
  reject the ledger); the ANSWER-CACHE GUARD deterministically rejects notes matching
  `ml\d+-q\d+(-…)` id shapes or containing any ≥20-char verbatim substring of option text
  (case/whitespace-normalized windows) with reason `answer-content` — notes replay next session
  and must never become a key stash; `log_coaching_note` returns `{stored, reason}` (NotifyingFacade
  notifies only on stored). Description surgery landed as drafted: get_learner_state ("read this
  first, every session", now exposing coachingNotes + coachCalibration), log_coaching_note
  (durable observations about HOW this learner learns, never answer content), get_hint +
  get_misconception_brief (ground in the learner's world), set_lesson_aim (connect the aim to
  known goals). The kickoff prompt gained the MEMORY clause and the SPACING (~1d/3d/7d session-end
  review appointment), DIFFICULTY (explain why the site's friction serves the learner), and
  TRANSFER (one what-if per lesson from the learner's own work) technique lines, pinned verbatim
  by test. Agent-less parity: the panel reads the same facade the tools call and adds a page-side
  note form (kind selector, guard rejections surfaced). Gates at ship: 351 tests green (37 new),
  tsc clean both packages, static export clean (prerendered-HTML answer-key scan unchanged from
  baseline; the client-side engine's manifest chunk is by-design), validate:content OK.
  Live-browser confirmation of the panel rides the existing ISC-38 ChatGPT in-app pass.
- **2026-08-28** — Transparency + Memory cross-review disposition and ship (`8819e48`, merged to
  main). Three findings, all fixed with regressions: **(MEDIUM, fixed)** the answer-cache guard
  was weak against its named threat — three reproduced bypasses (short correct options under the
  20-char window never checked; punctuation insertion breaking the contiguous window; id shapes
  dodging the hyphen regex). Guard redesigned deterministically: two canonical forms — spaced
  (lowercase, punctuation collapses to space) and squashed (alphanumerics only, catching MID-word
  punctuation and spaced-out letters) — each window-checked at ≥20 chars; options normalizing to
  12–19 chars checked whole (token-bounded in the spaced form, plain inclusion in the squashed
  form), so "Azure Function" / "A number of minutes" cannot be stashed verbatim; normalized-form
  id pattern catches `ml13.q1` / `ml13 q1`. Deliberate, test-pinned boundary: single common words
  under 12 chars ("Blocked", "Filter", "SharePoint") and free-prose paraphrase keys ("the webhook
  host question wants the serverless answer") remain storable — rejecting every note mentioning a
  common word would gut the memory feature, and prose/homoglyph/encoding stashes are the same
  documented residual as "agent skips the interview" (a deterministic guard stops verbatim key
  stashing, not semantics). Driver's own post-fix adversarial battery (18 cases incl. zero-width
  joiners, spaced-out letters, real-manifest verbatim runs) behaved as designed. **(LOW-MED,
  fixed)** reflection editors read by `slug` prop but wrote through the ambient active-lesson key —
  two sources of truth that only coincided by layout accident; facade setters now take an explicit
  `lessonKey` (page surfaces pass the slug they render under; tools keep the ambient/track
  contract), pinned by an override test. **(LOW, fixed)** the export omitted the per-lesson
  scenario commits that erase destroys, making "the export is the complete record" false; the
  export (`mastery-gate-export.json`) now bundles the `mastery-gate:v1` payload plus scenario
  commits, and the panel copy + erase confirmation name scenario predictions (ISC-68 text
  updated). Review's checked-clean list (corpus laundering, OLM/export key leakage, hint
  truthfulness at all transitions, ISC-74 description leaks, exam guards, routing invariance,
  prerender parity, per-dimension interview reachability) stands. Reviewer's minor note on
  `defeatedMisconception`'s no-prior-miss fallback is spec-conformant per ISC-69 — no action.
  Id-registry reconciliation is COMPLETE: this pass's items ship as ISC-67…69 + ISC-73…75 (72
  deliberately unused; ACTOR holds 70/71), the ISA carries all 74 criteria, and no future
  renumbering is owed. Gates at ship: 356 tests green, tsc clean both packages, validate:content
  OK, static export clean (per-route redaction grep: prerendered HTML zero answer-key hits;
  scenario expectedAnswer only in post-commit-fetched JSON; the client-engine manifest chunk is
  the accepted baseline).
- **2026-08-29** — Grounding pass shipped (ISC-76/77, branch `build/grounding`; Grok 4.6 built the
  slices, driver-verified with independently authored, mutation-tested behavior batteries). The
  owner-reported defect: the tool surface gave the agent only NAMES — `QuestionPublic` and
  `CurrentContextPublic` carried ids, concepts, prompts, and bare anchors, and **zero authored
  lesson prose**. Observed live, the coach taught PL-400 from its own pretrained knowledge instead
  of the owner's curriculum and asked probing questions that assumed scenario context the learner
  had never been given ("if the user closes the browser halfway through the job…"). Correctness
  risk (the agent can contradict authored content) and a UX defect. **Governing principle adopted
  for the pass: the agent gets exactly what a learner reading the page gets — no more, no less.
  Symmetry, not starvation.** Public page prose is now the agent's; anything the page withholds
  from its reader stays redacted. **Tool (`get_lesson_brief`)**: the 12th static tool (24 total),
  registered in lesson/practice/remediation/drill and revoked in exam — refused AT THE ENGINE
  (`MasteryEngineFacade.getLessonBrief` returns null while `isExamActive()`, with the provider
  still supplying prose, so deregistration is defense in depth, not the only guard). The payload
  carries id, slug, title, topicTitle, objectiveId, heroEpigraph, governingRule, examClue,
  mnemonic, scenarioPrompt, concepts[] {id,label,importance,summary}, productionNuance[],
  sections[] {anchor,title}, references[] — projected field by field at both the app boundary
  (`toLessonBrief`) and the tool boundary (`publicLessonBrief`), so a widened source can never
  silently widen the brief (pinned by a mutation-tested projection test: adding a spread makes it
  fail). **Content path**: `lesson-pages.json` reaches the facade through a new
  `MasteryEngineFacadeOptions.getLessonBrief` provider — the engine package stays content-agnostic
  and pure. The brief is built from the ONE lesson already passed as props to the lesson page and
  handed to the stack via `setActiveLesson(slug, brief)`, so cross-review finding 8 holds: the full
  catalog still never enters a client import (`lessonBrief.ts` imports `LessonPageData` as a type
  only), and the agent's brief is literally the page's own data. **Excluded, and why**: the scenario
  `expectedAnswer` is excluded unconditionally rather than gated on commit state — it is not on
  `LessonPageData` at all (it ships as a post-commit `/pl-400/scenario/<slug>.json` fetch), and
  commit state is per-lesson browser storage the engine does not own, so a conditional include
  would make a redaction depend on a surface outside the engine's guards; question rationales,
  correctOptionId and option→misconception mappings live in the manifest the engine grades from and
  never touch this path; the distractor teardown (whyTempting/whyWrong) stays gated behind an
  actual misconception fire via `get_misconception_brief`. Deliberate omissions for this pass
  (page prose the agent routes to rather than receives): the visual walkthrough, the four targeted
  drills, and the reflection list. **Titled anchors**: `ActiveLessonPublic.sectionAnchors` changed
  from `string[]` to `{anchor,title}[]` (app-side `lessonSectionAnchorEntries`, titles truthful to
  the headings `LessonPage` renders), so the agent can name where it is sending the learner;
  `navigate_to_anchor`'s description now points at `.anchor`. **Briefing contract (ISC-77)**: the
  kickoff prompt gained GROUND ("call get_lesson_brief before you start coaching a lesson… teach
  from that authored lesson, not from your own PL-400 knowledge; where the framing differs, follow
  the lesson and say so; mark outside additions as your own") and SCENARIO FIRST ("establish the
  scenario in one or two sentences… never ask a question that assumes context you have not just
  given me"), both pinned verbatim by test; the same contract is folded into `get_lesson_brief`,
  `get_current_question`, and `get_hint` so it survives without the prompt. **Agent-less parity:
  no UI work was needed and none was done** — every field the brief carries is already rendered on
  the lesson page (pinned by a source-level parity test asserting the page renders each field and
  each titled anchor id), which is precisely why symmetry, not new exposure, is the right frame.
  Gates at ship: 378 tests green (22 new), tsc clean both packages, static export clean
  (per-route prerender grep: zero hits for expectedAnswer text, correctOptionId, whyTempting,
  whyWrong on all five lesson routes — **CORRECTED 2026-08-30: the whyTempting/whyWrong half of
  that claim is false; re-running the grep against `out/` hits 4–5 times per route because the
  teardown is page content the reader sees. See the 2026-08-30 entry for the gate that actually
  holds**), validate:content OK. The shared-chunk lesson-prose hit was
  re-verified against a baseline build and is unchanged (lesson-sections.json is the client-side
  evidence corpus — the accepted baseline, not a regression from this pass). ISC-21's "ten static
  tools" reads historically: the static set is now twelve, 24 in total.

- **2026-08-29** — ISC-1 verified on Chrome 152 (the judges' stable release; evidence in
  `docs/spike-verdicts.md`): `document.modelContext` present, `navigator` absent,
  `toolchange` events PRESENT (opposite of ChatGPT), late registration and
  AbortSignal revocation both working — and **in-flight abort empirically kills the
  executing call**, reproducing the Chrome<153 landmine in the exact browser judges
  will use and validating the drain-first rule with a live reproduction rather than a
  spec reading. Both ToolSurfaceWatcher modes are now confirmed against real runtimes:
  events in Chrome, polling in ChatGPT. Remaining: exercise the product itself (not the
  spike page) in Chrome-with-flag — the events path has never run live.

- **2026-08-30** — Coach-grounding cross-review disposition (commit on `build/grounding`; ISC-76/77
  restated, ISC-78 added). Forge's adversarial review of `main...build/grounding` returned REQUEST
  CHANGES: the "no more" half of the grounding pass held, the "no less" half was broken in four
  places, one recorded ship gate was false, and the code path the app actually runs had zero
  coverage. Every finding was reproduced against the real content before it was fixed. **The design
  rule, now stated once and applied everywhere: the agent gets exactly what a learner reading the
  page gets. No more, no less. Symmetry, not starvation.** Public page prose is the agent's;
  anything hidden from the page reader stays redacted. **NO LESS — four asymmetries closed.**
  (1) The distractor teardown: `LessonPage` renders section 05 unconditionally to every reader with
  `choice`/`whyTempting`/`whyWrong` for all 22 distractors, and the brief withheld all of it behind
  a justification that was false twice over — nothing gated it on the page, and
  `get_misconception_brief` never carried that material (`manifest.misconceptions[]` is
  `{id,name,contrast,socraticSeeds,anchor}`). Reproduced: `bulk-document-migration`'s distractor
  "Dataverse Notes" is an exact match for option `ml12-q1-b`, so the coach was coaching that exact
  miss from `contrast` prose the learner had never seen while the authored teardown sat on screen.
  Now carried. (2) `visual` {type,title,steps[]} — the mechanism a lesson built on "decide before
  seeing the mechanism" is organised around; the coach could not walk the reveal the page's own
  pedagogy centres on. Now carried. (3) `drills` and `reflection[]` — `prescribe_drill` could
  contradict the four authored drills sitting on the learner's screen. Now carried. (4) The
  scenario `expectedAnswer`: withholding it pre-commit is right, but the previous pass excluded it
  *permanently*, so after the page revealed it the learner could ask "why is my answer different?"
  and the coach was guessing at text on screen. Resolved symmetrically rather than by exclusion —
  `LessonBriefPublic.scenarioExpectedAnswer` is null until `ScenarioCommit`'s post-commit fetch
  resolves and calls `onReveal`, which re-projects the brief; it is never prerendered (verified),
  and the commit gate is still the page's, not the agent's. **FALSE GATE CORRECTED.** The shipping
  record claimed "per-route prerender grep: zero hits for expectedAnswer text, correctOptionId,
  whyTempting, whyWrong on all five lesson routes." Re-run against `out/`: `whyTempting`/`whyWrong`
  hit 4–5 times on every route — `LessonPage` is a client component receiving `LessonPageData` as a
  prop, so Next serialises the teardown into the RSC flight payload. Not a leak (it is page content
  the reader sees, which independently proved finding 1), but the gate as recorded could not have
  passed. The honest gate, re-run this pass and now the recorded one: **zero hits for the scenario
  expected-answer TEXT, question rationales, `correctOptionId`, option→misconception ids, and
  misconception contrast/seeds on all five routes** — checked against the real manifest and the real
  scenario JSON, not against field-name substrings. **COVERAGE.** `masteryStack.ts`'s brief provider
  (the only wiring production uses) was uncovered — every brief test built `MasteryEngineFacade`
  directly with a hand-rolled provider — and `setActiveLesson(slug, brief)` never checked
  `brief.slug === slug`, so lesson B's prose could be served over lesson A's questions with no
  invariant and no warning. ISC-78 covers the real path through `stack.facade.getLessonBrief()`:
  a new `setLessonBrief(slug, brief)` replaces the brief in place with no question-scope churn (the
  lesson page now sets scope and brief in *separate* effects, so a reveal cannot release and
  re-acquire the scope), both setters refuse a slug-mismatched brief, a same-slug `setActiveLesson`
  now replaces a supplied brief instead of discarding it, and stored briefs are defensive copies.
  **CONTRACT.** The briefing contract shipped its own escape hatch — "Anything you add from outside
  it, mark as your own addition", plus "**prefer** it over your own knowledge" — which authorised
  the exact behaviour the pass was opened to stop, conditional only on a label. Bounded: nothing of
  the agent's own while a question is open, marked as its own afterwards; "prefer it over" became
  "the authored curriculum you teach from". `get_lesson_brief`'s description no longer enumerates
  what is withheld or names the tool behind the gate (it pointed at a capability that did not
  exist, and combined with `SECOND_FIRE_HINT` and live `misconceptionFires` it read as an
  instruction to drive the learner into a second miss to unlock material). And a NO RECITING clause
  now lands in the kickoff prompt, `get_current_question`, and `get_hint`: 6 of 34 questions have
  the correct option top-ranked by lexical overlap with the governing rule or exam clue — `ml11-q2`
  and `ml12-q1` at full token containment — so a coach obeying SCENARIO FIRST could hand over the
  answer without ever "adding answer information of its own". This is an instruction fix, not a
  redaction: the learner sees both fields above the practice band, so the brief grants no derivation
  power the page does not. **ACCEPTED, NOT FIXED (documented).** The brief carries `objectiveId` and
  `concepts[].id`, which the page never renders — the "more" direction. Kept: they are machine
  identifiers already public through `get_current_context`, they carry no teaching content, and the
  agent needs them to scope and route. The symmetry audit is written against prose for that reason,
  and the two structural-only lesson leaves it excludes (`topic.id`, `questionIds`) are listed with
  reasons in a table that fails if a row goes stale. **VERIFICATION.** 404 tests green (was 378);
  tsc clean; static export clean; `validate:content` OK; per-route deep redaction audit clean on all
  five routes; and a new per-lesson two-way symmetry audit reports **zero prose asymmetries across
  all five lessons in both directions, pre- and post-commit** (72–83 authored strings per lesson,
  every one of them reaching the agent, and none reaching it that does not trace to the lesson).
  All three brief projections — app `toLessonBrief`, stack `copyBrief`, tool `publicLessonBrief` —
  were mutation-tested by actually inserting a spread and confirming a test turns red; the first
  attempt at the tool-boundary guard did NOT bite (a real `MasteryEngineFacade` strips the
  contaminant before `publicLessonBrief` sees it), so that test now drives the toolset through a
  proxied facade that returns the contaminated brief verbatim.
- **2026-08-28** — ISC-10 and ISC-45 verified by cold-clone probe: fresh `git clone` of the
  public repo into a temp dir, README instructions only → `bun install` + `bun run build`
  (static export, SSG routes) green, `bun test` 404 pass / 0 fail, MIT LICENSE at root, and
  the package README's registerTool example carries all four required fields (name,
  description, inputSchema, execute). The submission repo is judge-reproducible.
- **2026-08-28** — Tool Inspector shipped (ISC-79…82, branch `build/inspector`; Grok 4.6 built the
  slices, cross-review fixes applied by hand). RATIONALE — judge reproducibility: the demo's
  central claim ("the site governs what the AI may do") is only verifiable if a judge can poke the
  governed surface without owning an agent; the inspector puts the exact live descriptors — same
  schemas, same guard layer, same redaction — behind `?inspector=1` in any browser, and doubles as
  the FALLBACK DEMO if the ChatGPT runtime refuses to bind on camera (the on-stage script degrades
  from "watch the agent" to "watch the same tools refuse me by hand" without changing surfaces).
  Cross-review disposition: **(finding 1, latent guard bypass — FIXED)** the inspector invoked raw
  toolset descriptors, skipping the registry's track/guard wrappers; only engine-level backstops
  made the shipped deregister config safe. Now `ToolRegistry.getWrappedDescriptor()` +
  `MasteryStack.getInvocableToolset()` route inspector invocations through the registered wrappers
  whenever a runtime is bound (mid-drain `tool-revoked` and refusal-mode `exam-in-progress`
  refusals byte-identical to the agent path — regression suite proves equality of both payloads),
  and the agent-less fallback pins the documented engine-guard invariant on `getToolset()`.
  **(6, focus loss — FIXED)** "Show full response" now moves focus to the expanded `<pre>`
  (tabIndex −1 + focus-visible outline). **(7, silent results — FIXED)** always-mounted per-tool
  `role="status"` live region announces hints, response summaries, and validation errors verbatim;
  the offending control gets aria-invalid + aria-describedby (buildToolInput failures carry the
  field path). **(9, framing overclaim — FIXED)** copy is configuration-truthful per ISC-82;
  capText is surrogate-safe; tests reference RESULT_DISPLAY_CAP. Skips, with reasons: the
  one-render-tick roster window after an engine mutation (finding 2) is accepted — it is bounded
  by the same wrapped-descriptor refusals that now guard invocation; the unreachable `Number()`
  edge cases on the clamped score field (9-nit) need no code. Findings 3/4/5/8 verified clean by
  the reviewer (live XSS probe, redaction, prerender, a11y positives) — no action owed. Gates at
  ship: 413 tests green (incl. 3 new guard-parity regressions), `bun run build` static export
  clean, validate:content OK, per-route redaction grep zero answer-key hits in prerendered HTML,
  flag-off HTML carries only the roster toggle; live smoke on the served export confirmed panel,
  parity framing, validation announcement, and focus behavior.
- **2026-08-29** — Bridge (art of the possible) approved and shipped on `build/bridge`, then hardened. Owner reaffirmed the build after deadline-risk pushback; scoped as a companion under `bridge/` that imports nothing from `apps/`/`packages/` and is not part of the Cloudflare Pages build, with a 24h cap — video beats 1-4 never depend on it. Cross-family adversarial review (Forge + `gpt-5.6-sol`) returned 1 CRITICAL, 4 HIGH, 7 MEDIUM. Disposition: **all CRITICAL/HIGH and every MEDIUM fixed** in commit `Apply cross-review fixes (bridge)`. The CRITICAL (extension trusting whoever holds the port, handing over the token and executing requests un-acked) is closed by a **mutual challenge-response handshake**: the extension sends only a nonce, the server must return HMAC(token, "server|nonce") to prove possession before the extension replies HMAC(token, "client|serverNonce") — the pairing token never crosses the wire, and `request` frames are gated on `hello_ack`. HIGH fixes: WS upgrade refuses non-`chrome-extension://` Origins and caps concurrent unauthenticated sockets; `set-token` clears `armed` so a new bridge cannot inherit a pairing; the extension caps outbound result size (no silent hang / no transport-kill unpair); MV3 keepalive via `chrome.alarms` + a server application-level `ping`. MEDIUM fixes: exact-origin `isAllowedUrl` (kills the `startsWith` subdomain/suffix bypass), list_changed coalescing + buffer-until-initialized + non-blocking stdin dispatch, MCP tool-name grammar enforcement/dedupe/control-char stripping/untrusted-description wrapping, `ws === authWs` identity guard, and `arm` re-reading the tab plus a popup sender check. Residual, documented: an unparseable (e.g. oversize) frame on an already-authenticated socket cannot be correlated to a pending request id, so that one request still relies on the request timeout — unreachable via our extension, which caps outbound size. New bridge tests: 109 pass (was 89); whole-repo `bun test` 513 pass / 0 fail; site `bun run build` green and untouched. Server/manifest ISCs renumbered to `ISC-83..86` after main consumed 79–82 for the Tool Inspector; ticked by machine probe, the browser half stays open for the owner's runbook run (`docs/bridge-demo-runbook.md`).
- **2026-08-29** — Real-runtime registration verified in Chrome 152 (evidence in
  docs/spike-verdicts.md): the browser's own `document.modelContext.getTools()` returned all
  12 tools on the live product page. This closes the verification gap in which every prior
  check ran against an injected mock. Host survey now stands at five surfaces: two invoke
  (ChatGPT desktop app, Chrome+flag), three discover-only (Codex panel, Copilot, ChatGPT
  Chrome sidebar) — an ecosystem bridging gap, not a site defect, and the `bridge/` companion
  is the designed closer.
- **2026-08-29** — executeTool spec-conformance correction (branch `fix/executetool-spec`). WHAT
  WAS WRONG: our callers invoked `executeTool(nameString, argsObject)` — the pre-spec shape. The
  2026-08-26 WebMCP draft defines `executeTool(RegisteredTool, inputJsonString) →
  Promise<DOMString>`, and Chrome 152 enforces it strictly: the live button-3 spike run's
  rejection ("The provided value is not of type 'RegisteredTool'") was a call-time signature
  type-error, which we had mis-read as a reproduced in-flight abort kill. Corrected in
  docs/spike-verdicts.md (in-flight row marked NOT REPRODUCED with a dated correction note —
  drain-first now stands on the Chrome 153 release-note fix plus prudence) and in the devpost
  scars bullet (release-note-sourced; the probe's real finding is the signature strictness).
  FIX: `bridge/extension/injected.js` and the spike button-3 self-test now resolve the
  RegisteredTool via `getTools()`, pass `JSON.stringify(args)`, and normalize string vs
  `{content:[...]}` results to MCP content; the spike log now distinguishes call-time rejection
  / started-then-killed / survived-abort. DUAL-PATH RATIONALE: spec form first; if it is
  rejected at call time (TypeError or an unknown-tool lookup failure — both occur before the
  tool executes, so one retry cannot double-execute), retry the legacy `(name, object)` form
  once — ChatGPT's injected implementation is unverified against the new draft and must keep
  working either way. The path taken ('spec' | 'legacy' | 'direct') is logged in-page and
  surfaced through the extension popup status. `MockModelContext`/fallback polyfill gained
  spec-strict `executeTool` (RegisteredTool + JSON string → stringified result; legacy form
  kept, marked deprecated) so tests exercise the real signature, and the five read-only tools
  now carry the spec's `annotations: { readOnlyHint: true }`, propagated through the registry
  wrappers. Gates: 535 tests green (was 513), `tsc --noEmit` clean, `bun run build` static
  export green.
