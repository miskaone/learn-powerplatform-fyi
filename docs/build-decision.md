# BUILD DECISION — OpenAI WebMCP Challenge

> **Amended 2026-08-26 — the learn-subdomain shape.** The submission moves out of the private
> site repo entirely: one **public** repo (`miskaone/learn-powerplatform-fyi`, MIT code / CC BY 4.0
> content) deployed as a second Cloudflare Pages project at **`learn.powerplatform.fyi/pl-400`**,
> with the engine as an internal workspace package (`packages/mastery-gate`). Rationale: makes the
> entire submission (app + engine + content + WebMCP surface) one inspectable artifact, satisfying
> the all-source rule with zero ambiguity; isolates hackathon-paced work from the flagship repo;
> converts the risky PL-400 branch **merge** into a simple content **port**. Affected sections
> edited inline below.

## 1. THE RECOMMENDED CONCEPT

**Working name: MASTERY GATE — "The Site That Governs What the AI Is Allowed to Be"**

A merge, because all three panels independently concluded the 29 concepts are one product photographed from 29 angles. The composite:

- **Spine:** *Mastery Gate* flagship (= *The Coach That Can't Cheat* / *Proctored Mastery Loop* — same build)
- **Legibility layer:** *The Vanishing Toolset*'s live on-page **Tool Roster panel** (all 3 panels flagged this as the device that makes toolchange leverage visible to judges; without it, dynamic registration is invisible plumbing)
- **Transfer drill:** *The Flip-Condition Machine* (cheapest real depth — runs on already-shipped `src/lib/signals/rules.ts`; unanimous "best effort-to-wow ratio")
- **Second-act beat:** *Exam Mode*'s tool-revocation lockout — **conditional on the Day-1 deregistration spike passing**, with the refusal-state fallback built in parallel
- **Submission strategy:** one public repo, `miskaone/learn-powerplatform-fyi`, containing the whole product — app, engine (as workspace package `packages/mastery-gate`), WebMCP surface, and instrumented content — deployed at `learn.powerplatform.fyi/pl-400`. *CoachKit* demoted to what it actually is — the engine package's README, structure, and Devpost framing. The repo IS the submission; the subdomain is the live demo. The private-repo problem no longer exists because the flagship repo is no longer involved.

**One-sentence pitch:** A live PL-400 adaptive course at learn.powerplatform.fyi where a unit-tested deterministic TypeScript engine — not prompts — decides what ChatGPT is allowed to know, say, and be at every moment, by redacting answer keys at the tool boundary and registering/revoking the agent's tools as the learner earns mastery.

**The "holy shit" demo moment (three beats, one engine):**
1. Learner types "just tell me the answer" — the visible tool response shows `answer: [withheld by engine — attempt 1 of 2 unused]` and ChatGPT pivots Socratic. *The architecture, not a system prompt, made the AI honest.*
2. Learner picks the trap distractor; the page names the misconception (`client-side-enforcement-only`), calls `navigate_to_anchor`, and the live page scrolls itself to the "where it executes" section — human and agent now reading the same paragraph.
3. The rubric passes the every-dimension-≥3 gate and **`advance_module` materializes in the agent's tool list on camera** via `toolchange`, visible in the Tool Roster panel. Narrator: *"The site just told the AI what it's now allowed to do."*

## 2. THE WEBMCP TOOL INVENTORY

### Always registered (session lifecycle)
| Tool | Purpose | Registration |
|---|---|---|
| `get_learner_state` | Rubric scores (R/C/A/T 0-4), misconception ledger, phase, gate status — never an average, never key material | Static |
| `get_current_context` | Active lesson section + concepts, prerequisites, objectiveId; **answer key structurally absent from the return schema** | Static |
| `navigate_to_anchor` | Scrolls/highlights the prescribed remediation section in the live page — page-state mutation | Static |
| `log_coaching_note` | Persists coach notes to localStorage for cross-session continuity, zero backend | Static |

### Practice phase
| Tool | Purpose | Registration |
|---|---|---|
| `get_current_question` | One question at a time, engine-enforced; answer key and distractor map REDACTED | Static |
| `submit_answer` | Deterministic grading; a miss returns the **named misconception**, never the key | Static |
| `get_hint` | Engine-controlled hint ladder; refuses tier-2 before a real first attempt | Static |
| `request_next_action` | The routing verdict: hint \| review \| coach \| go_deeper \| advance — engine decides, agent executes | Static |

### Diagnosis & remediation (dynamic)
| Tool | Purpose | Registration |
|---|---|---|
| `get_misconception_brief` | Contrast statement + Socratic seeds + lesson anchor | **Dynamic — registered via toolchange only after a repeated misconception fires** |
| `prescribe_drill` | Weakest-dimension drill routing (spaced review / Feynman / failure-case / what-if) | Static |

### Transfer drill (Flip-Condition Machine)
| Tool | Purpose | Registration |
|---|---|---|
| `mutate_assumption` | One assumption change per round, engine-enforced | Static |
| `commit_prediction` | Irreversible prediction + reason before reveal | Static |
| `reveal_outcome` | **Locked until commit lands** — commit-then-reveal enforced by tool availability | Dynamic (registered on commit) |

### Mastery & exam
| Tool | Purpose | Registration |
|---|---|---|
| `score_rubric` | Agent submits 0-4 scores WITH verbatim evidence quotes; engine validates, clamps, enforces the gate | Static |
| `advance_module` | **Does not exist until every dimension ≥3** — its appearance IS the mastery signal | **Dynamic — the flagship toolchange moment** |
| `start_exam` / `get_exam_status` / `submit_exam` / `get_exam_debrief` | Exam mode: coaching toolset revoked, only `get_exam_status` survives; debrief tool registered post-submit | **Dynamic — mass deregistration + re-registration** (fallback: refusal states) |

**The "thoughtful use of WebMCP" story rests on three tools:**
1. **`advance_module`** — dynamic registration as a mastery gate made physical; capability itself, not a prompt, is the guardrail.
2. **`get_current_question` / `submit_answer`** — redaction at the tool boundary: the agent cannot leak what the schema never contains.
3. **`start_exam`'s mass tool revocation** — toolchange as proctoring; the site takes the agent's capabilities away and gives them back, on camera, in the visible Tool Roster panel.

## 3. THE GRAFT (amended 2026-08-26 — one candidate, replacing the original three)

**Mastery Debrief** — at module completion, the site assembles a ~60–90s debrief film from
the engine's ledger: named title card → the misconceptions that actually fired, each with
its authored coach line → the rubric radar animating to real scores → the prescribed drill.
Motion (MIT) scenes at runtime, ElevenLabs audio baked at build time (finite segment
library, key in env), zero runtime AI/TTS calls. `compose_debrief` is dynamically
registered at completion and ledger-validated — the agent directs the film, the site owns
the footage. **Live-narrator mode** (the ceiling): the agent paces the film via
`get_narration_script` / `advance_segment`, narrating in its own pane with the learner's
name and session references; baked audio remains the deterministic floor and the recorded
demo's guaranteed take. Pre-authorized degrade: text debrief card. **Cost: ~1.5–2 days.
Go/no-go at the Day-6 checkpoint; it never competes with spikes, engine, or tool surface.**
(Trap Cards, the Report Card twist, and Readiness Radar are out of contention; the
prediction-lock idea survives inside `compose_debrief`'s validation. ISA: ISC-56…61.)

## 4. THE 9-DAY CUT

**Phase 0 — Day 1: Kill the unknowns (non-negotiable, do nothing else first)**
- Spike WebMCP namespace (`navigator.modelContext` vs `document.modelContext`) in BOTH ChatGPT in-app browser and Chrome behind the flag. Write the ~30-line feature-detecting adapter shim (this shim is also OSS gold for the README).
- Spike dynamic registration/deregistration + `toolchange` behavior in both targets. **Verdict by end of day:** Exam Mode ships as real revocation or as refusal-state fallback. Build the fallback registry abstraction either way (same interface, two backends).
- Scaffold `miskaone/learn-powerplatform-fyi` (public, MIT LICENSE at root from commit one; CC BY 4.0 notice for content). Same proven stack — bun + Next static export — with the engine as workspace package `packages/mastery-gate`. Copy design tokens from the main site; do NOT build a shared package.
- Stand up the second Cloudflare Pages project + `learn` subdomain. Three scars from the staging ISA apply verbatim: (1) API domain-attach does NOT create DNS — create the `learn` CNAME as its own explicit step; (2) the Pages GitHub App is scoped per-repo — grant the new repo or hit the misleading `8000012` error; (3) create the Pages project BEFORE the first real push, since creation doesn't retroactively build commits.
- Port the PL-400 micro-lessons content into the new repo (copy MDX + adapt frontmatter to the metadata schema). If the source series isn't retrievable same-day, fall back to Support Ticket Lab content — do not let this decision drift.
- Port `signals/rules.ts` from the private site repo into the public one (owner's license grant, decided 2026-08-26) and verify it is client-safe (not entangled with build-time plumbing).

**Phase 1 — Days 2-3: Engine**
- Deterministic engine as pure TypeScript in the `site-graph.ts` idiom: grading, misconception mapping, attempt counting, 4-dimension rubric, every-dimension-≥3 gate, next-action routing, hint ladder, localStorage state. Vitest via bun. This is the unit-tested referee everything else trusts — do not start UI until its test suite is green.
- Tool registry state machine (register/retract via AbortSignal, phase-driven) on top of the adapter shim.

**Phase 2 — Days 3-5: Content (the long pole, runs parallel to Phase 3)**
- Author ~25-30 questions across **TWO deeply-instrumented PL-400 objectives** (not the whole outline), every distractor keyed to a named misconception, remediation anchors into existing lesson sections. Owner-only work — protect these days.
- Two Flip-Condition scenarios encoded as decision tables with unit tests and lesson citations (an arguable verdict on camera destroys the examiner's authority).

**Phase 3 — Days 5-6: UI**
- Quiz flow, rubric radar panel, **Tool Roster panel** (getTools + toolchange listener — cheap and load-bearing), hint/review/gate states, page-scroll highlight for `navigate_to_anchor`. Site must work agent-less too (buttons drive the same engine) — that's an Execution point.
- Exam Mode timer + revocation (or fallback) — ~1 day on top of the registry.

**Day 6 checkpoint — go/no-go on grafts.** Behind → cut Exam Mode to fallback, skip all grafts. Ahead → Trap Cards UI or Report Card twist, pick ONE.

**Day 7 — MINIMUM SUBMITTABLE PRODUCT must exist:**
> Live at learn.powerplatform.fyi/pl-400: two instrumented objectives, working engine with redacted tool surface, `advance_module` dynamic registration firing, Tool Roster panel, Flip-Condition drill, all testable in the ChatGPT browser. Repo public since Day 1. Everything after this day is video, docs, and polish — no new features cross this line.

**OSS strategy (amended):** no extraction step exists — the repo is public from Day 1 and the engine lives at `packages/mastery-gate` inside it with its own README carrying: the required tool-registration example (name/description/inputSchema/execute), the schema docs, and the "Coachable Docs" roadmap section (captures CoachKit's ambition at ~5% of its cost). Standalone-repo extraction is a post-contest decision, taken only if adoption warrants. No npm publish ceremony, no semver theater — a clean package with tests beats a polished release.

**Day 8 — Demo video.** Tightly scripted 3 beats (+ optional twist), multiple takes, recorded in the ChatGPT in-app browser. The deterministic engine is your friend: same inputs, same routing, every take.

**Day 9 — Buffer + Devpost docs** (use-case fit, UX improvement, collaboration story, implementation description — the "site governs the agent" narrative), submission by noon PDT margin.

## 5. TOP 5 RISKS

1. **WebMCP API instability / namespace churn between ChatGPT browser and Chrome flag.** *Mitigation:* Day-1 adapter shim with feature detection; test in BOTH targets daily from Day 1, never batch verification to the end; getTools-polling fallback for toolchange.
2. **Dynamic deregistration (Exam Mode's bet) unverified in the ChatGPT browser.** *Mitigation:* Day-1 spike is a hard gate; refusal-state fallback (tools stay registered, return proctor refusals) built behind the same registry interface — same narrative, one-line swap. Exam Mode is a capstone, never the load-bearing act.
3. **Content authoring is the schedule's long pole; the PL-400 series lives in another session.** *Mitigation:* port (not merge) into the new repo on Day 1 or immediately fall back to published Support Ticket Lab material; scope-locked to two objectives; if authoring slips, cut item count — never the gate/drill machinery.
4. **Demo video constraints (3 min, agent nondeterminism, everything must land visually).** *Mitigation:* Three-beat script written before Day 8; Tool Roster panel makes invisible protocol events visible; deterministic engine guarantees reproducible routing across takes; rehearse the "agent hallucinates / breaks character" path; record extra takes of each beat separately.
5. **Public repo licensing/completeness disqualification.** *Mitigation (largely dissolved by the amendment):* the submission repo is public from Day 1 and contains ALL source by construction — MIT LICENSE at root from commit one, CC BY 4.0 notice for lesson content, the required registerTool example verbatim in the package README; sanity-check the Devpost checklist against the repo on Day 9 morning. New residual risk: the second Pages project + subdomain is fresh infrastructure — stand it up Day 1 (with the three documented scars) so deploy is boring by Day 7. Also state plainly in the writeup that `score_rubric` trusts agent-supplied scores with evidence-quote validation and clamping — judges will ask; pre-answering it reads as rigor.

## 6. WHAT WE DELIBERATELY DO NOT BUILD

- **Anything with a drag-drop canvas** — Cartographer, Living Concept Map, Knowledge Network Builder, Three Maps. Highest creativity, lowest 9-day survival; a janky drag on camera costs more Execution than the spectacle earns. (All three panels, unanimous.)
- **Free-text NLP scoring** — Skeptical Apprentice's checklists, Feynman Inversion's keyword anchors, Pedagogy Lint's heuristics. All gated scoring comes from structured items only; free text feeds nothing that gates.
- **Any demo that requires the model to fail on cue** — Grade the Coach, The Saboteur, Agent Sits the Exam as headline acts. A coin-flip is not a demo plan. (Report Card twist is the only exception, and only as a pre-seeded, disclosed, optional 15 seconds.)
- **A second demo experience (the split-screen CoachKit scaffold)** — learn.powerplatform.fyi IS the one product site; the README roadmap section captures CoachKit's ambition; the video's 3 minutes belong to one product.
- **Coachable Docs Compiler** — self-confessed unshippable; roadmap paragraph only.
- **Lab Proctor / Dataverse integration** — judges can't reproduce it; Phase-2 roadmap line in the writeup.
- **More than two PL-400 objectives, accounts, backends, LLM proxies, the embedded fallback coach, spaced-review calendars, npm publish ceremony, mobile-first polish** (verify it *renders* in the ChatGPT in-app browser; optimize for desktop demo).

The scope fence in one sentence: **one site, one engine, two objectives, three toolchange moments, zero canvases, zero NLP, under three minutes.**
