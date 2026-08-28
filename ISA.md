---
task: "Build and submit Mastery Gate WebMCP Challenge entry"
slug: 20260826-093000_mastery-gate-webmcp-challenge
project: learn-powerplatform-fyi
effort: E3
effort_source: auto
phase: execute
progress: 33/61
mode: build
started: 2026-08-26
updated: 2026-08-27
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

- [ ] ISC-1: WebMCP namespace verdict for Chrome-behind-flag recorded in the repo (which of `navigator.modelContext` / `document.modelContext` resolves, with probe output)
- [x] ISC-2: WebMCP namespace verdict for the ChatGPT in-app browser recorded in the repo
- [ ] ISC-3: Adapter shim feature-detects both namespaces and passes unit tests against a mock of each
- [x] ISC-4: Dynamic deregistration spike verdict recorded in Decisions — Exam Mode mode chosen (real revocation | refusal fallback) before any dependent work starts
- [x] ISC-5: Repository `miskaone/learn-powerplatform-fyi` exists and is public
- [x] ISC-6: MIT `LICENSE` file at repo root, present from the first commit
- [ ] ISC-7: CC BY 4.0 notice covers the lesson-content directory
- [x] ISC-8: Cloudflare Pages project exists — `source.type=github`, repo bound, `production_branch=main`, build `bun run build` → `out`
- [x] ISC-9: `learn` CNAME exists and `https://learn.powerplatform.fyi` returns HTTP 200 with valid TLS
- [ ] ISC-10: Cold clone passes `bun install && bun run build` with only the README instructions

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
