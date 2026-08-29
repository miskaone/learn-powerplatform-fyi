# Devpost Submission Draft — Mastery Gate (v2, 2026-08-28)

> Live: https://learn.powerplatform.fyi/pl-400 · Repo: https://github.com/miskaone/learn-powerplatform-fyi (MIT)
> Video: `[PENDING — YouTube link]`

---

## Mastery Gate — the site that governs what the AI is allowed to be

Every AI study tool has the same fatal flaw: ask it nicely and it gives you the
answer. That's fine for homework theater. It's useless for actually passing
Microsoft's PL-400 — and worse than useless for *learning*.

Mastery Gate inverts the relationship. The learner's own ChatGPT becomes their
personal exam coach — Socratic, adaptive, tireless — but the website decides,
deterministically, what that AI is allowed to know, say, and be at every moment.
Not with prompts. With architecture.

## Why this is a WebMCP problem

You cannot make a chatbot answer-proof with a system prompt. You *can* make it
answer-proof with a tool surface: WebMCP lets the page own the tools, so the
agent literally cannot leak what the schema never contained.

- `get_current_question` returns a redacted projection — the correct-answer field
  is structurally absent, not politely withheld.
- A miss returns a **named misconception** ("policy-precedence-instinct: assuming
  one data policy overrides another by scope") — a diagnosis, never the key.
- `advance_module` **does not exist** until a four-dimension mastery rubric
  (Recall · Connections · Application · Transfer, every dimension ≥ 3 — never an
  average) opens the gate. Capability itself is the guardrail: the tool
  materializes in the agent's tool list the moment mastery is earned.
- Exam mode **revokes the coaching toolset** — drain-first, so no in-flight call
  is ever killed — and hands back a debrief tool only after submission.

And because WebMCP means bring-your-own-agent, the site runs **zero AI
infrastructure**: no API keys, no proxy, no per-token cost, no backend at all.
A static export on Cloudflare Pages, a pure-TypeScript engine, localStorage
state — and the visitor's own agent supplies all the intelligence.

## Redaction is symmetry, not secrecy

The design rule that governs every tool response:

> **The agent gets exactly what a learner reading the page gets. No more, no less.**

That cuts both ways, and the second half was a real bug we shipped and fixed.
Early on the tool surface handed the agent only *names* — concept labels, section
ids, a question prompt — and no authored prose. The coach dutifully refused to
leak answers, then taught PL-400 from its own pretraining instead of the
curriculum, asking probing questions about scenarios the learner had never been
shown. Starving the agent is not the same as governing it. `get_lesson_brief` now
hands over the whole authored lesson — governing rule, exam clue, scenario,
concept summaries, the distractor teardown, production nuance — because a learner
on that page can read all of it. The scenario's expected answer stays `null`
until the learner commits their own, then appears: symmetry on a timer. Answer
keys, rationales, and the option→misconception map never cross the boundary at
all, because no reader ever sees those.

## The collaboration: a panel of two

This is not "agent drives my website." It's a division of labor between three
parties, each doing the only thing it can do:

- **The site** grades, counts attempts, diagnoses misconceptions, scores
  mastery, and gates progression — deterministic, unit-tested, un-negotiable.
- **The agent** teaches: Socratic questioning, elimination-with-principles,
  examples grounded in the learner's own work. In our first live session the
  coach volunteered *"I will not reveal or submit the answer"* — unprompted. The
  tool descriptions are its employment contract.
- **The learner** does the wrestling — aims, commits, explains, and earns.

The centerpiece is the **rubric interview**: when multiple-choice coverage is
sufficient, the engine's own routing verdict *hands the mic to the AI* — conduct
an open-ended teach-back interview, judge the learner's explanations, and submit
dimension scores **with verbatim evidence quotes** that the engine validates
against the lesson corpus, clamps, and gates. The AI does what only AI can
(understand an explanation); the site does what AI must not (certify mastery).
Neither could do it alone.

The agent also brings something the site can never build: it already knows the
learner. So the coach is licensed to ground examples in their real projects, to
deposit durable observations about *how this person learns* into the ledger for
future sessions, and to set the learner's next spaced-review appointment in its
own memory. **The site is the memory that survives agent amnesia; the agent is
the memory that survives a cleared browser.** Neither ever moves the gate.

## The learner experience

Five designed micro-lessons across two PL-400 objectives — 34 questions, every
distractor tagged with one of 17 named misconceptions, several shared across
lessons so *repeated* mental-model failures trigger a dynamically registered
remediation tool. Each lesson is scenario-first ("make the decision before seeing
the mechanism"), with commit-then-reveal interactions, an interactive mechanism
walkthrough, distractor teardowns, per-lesson practice, a flip-condition transfer
drill, and a proctored exam. A "Your model" panel shows the learner exactly what
`get_learner_state` shows the agent — the same misconception ledger, with the
questions that produced it — beside a one-tap erase. Everything works agent-less
through the page UI: the agent is an interface, not a dependency.

## Implementation notes (the scars)

We probed the runtimes before trusting any documentation, live at
https://learn.powerplatform.fyi/spike:

- `document.modelContext` only — `navigator` is deprecated and absent in both
  ChatGPT's runtime and Chrome 152.
- **ChatGPT exposes no `toolchange` events; Chrome does.** So the watcher
  feature-detects and runs events in Chrome, `getTools()` polling in ChatGPT —
  and gate-crossing tool *responses* announce surface changes ("advance_module is
  now available — re-check this page's tools"). When the protocol gives you no
  push channel, the payload becomes the push channel.
- `getTools()`/`registerTool()` return Promises in real runtimes — our sync test
  mocks hid that until production crashed. The mocks now tell the truth and the
  crash shape is a named regression test.
- **Aborting a registration mid-execution kills the in-flight call on Chrome 152**
  — the release that fixes it ships five days *after* this deadline. We
  reproduced it on the spike page, so revocation drains before it aborts, always.
- We verified against the W3C spec that **no static manifest discovery exists**
  — and deliberately shipped none. No coverage theater.

The pedagogy isn't vibes either: two evidence-graded research briefs in-repo
([learning science](docs/research/learning-science-alignment.md) ·
[learner modeling](docs/research/learner-profiling-and-adaptation.md)) map every
mechanism onto the literature — structural redaction against the documented
LLM over-scaffolding and sycophantic-grading failure modes, exam revocation
against the "crutch collapses when the aid is removed" RCT result, and
step-level routing on the strong side of the adaptive-instruction meta-analyses.

The engine and full WebMCP surface ship as an MIT package
(`packages/mastery-gate`); the pattern generalizes to any content site that wants
an AI coach without surrendering authority. I know it generalizes because I built
the same pedagogy — deterministic scoring, named misconceptions, repair routes —
for a completely different learner before it had a tool surface at all: my
daughter's engineering statics course (https://engineeringstatics.fyi). Mastery
Gate is what that pattern becomes when you hand it to an agent.

Every layer was cross-reviewed adversarially by a different model family than the
one that wrote it. That process found and sealed, among others, five independent
exam-escape paths, a self-serviceable mastery gate, and a tool response that
truthfully described a state change that never happened — before any judge could.

## What's next

The remaining designed lessons, more certification tracks, spaced-review
scheduling keyed to the misconception ledger, and the Mastery Debrief: a
personalized end-of-module film assembled from the learner's own ledger —
directed by the agent through `compose_debrief`, validated against the ledger by
the engine, and narrated live by the learner's own coach. `[Backend shipped;
the film is roadmap.]`

---

### Devpost form field mapping
- **Use-case fit for WebMCP** → "Why this is a WebMCP problem" + "Redaction is symmetry"
- **Improved user experience** → "The learner experience"
- **Collaborative capabilities** → "The collaboration: a panel of two"
- **Implementation description** → "Implementation notes (the scars)"

### Claim discipline
- Copilot/Edge: **omit** until the evidence line in docs/spike-verdicts.md is filled.
- engineeringstatics.fyi: cited ONLY as prior pedagogy, never as a WebMCP artifact — it has no tool surface.
