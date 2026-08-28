# Devpost Submission Draft — Mastery Gate

> Status: draft for owner edit. `[PENDING]` marks items that land before Sep 3.
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
- A miss returns a **named misconception** ("concept-collapse: treating a precise
  concept as interchangeable with nearby terminology") — a diagnosis, never the key.
- `advance_module` **does not exist** until a four-dimension mastery rubric
  (Recall · Connections · Application · Transfer, every dimension ≥ 3 — never an
  average) opens the gate. Capability itself is the guardrail: the tool
  materializes in the agent's tool list the moment mastery is earned.
- Exam mode **revokes the coaching toolset** — drain-first, so no in-flight call
  is ever killed — and hands back a debrief tool only after submission.

And because WebMCP means bring-your-own-agent, the site runs **zero AI
infrastructure**: no API keys, no proxy, no per-token cost, no backend at all.
A static export on Cloudflare Pages, a pure-TypeScript engine, localStorage
state — and the visitor's ChatGPT supplies all the intelligence.

## The collaboration: a panel of two

This is not "agent drives my website." It's a genuine division of labor between
three parties, each doing the only thing it can do:

- **The site** grades, counts attempts, diagnoses misconceptions, scores
  mastery, and gates progression — deterministic, unit-tested, un-negotiable.
- **The agent** teaches: Socratic questioning, elimination-with-principles,
  custom examples in the learner's own context. In our first live session the
  coach volunteered *"I will not reveal or submit the answer"* — unprompted.
  The tool descriptions are its employment contract.
- **The learner** does the wrestling — aims, commits, explains, and earns.

The centerpiece is the **rubric interview**: when multiple-choice coverage is
sufficient, the deterministic engine's own routing verdict *hands the mic to the
AI* — conduct an open-ended teach-back interview, judge the learner's
explanations, and submit dimension scores **with verbatim evidence quotes** that
the engine validates against the lesson corpus, clamps, and gates. The AI does
what only AI can (understand an explanation); the site does what AI must not
(certify mastery). Neither could do it alone.

## The learner experience

Five designed micro-lessons across two PL-400 objectives — 34 questions, every
distractor tagged with one of 17 named misconceptions, several shared across
lessons so *repeated* mental-model failures trigger a dynamically registered
remediation tool. Each lesson is scenario-first ("make the decision before
seeing the mechanism"), with commit-then-reveal interactions, an interactive
mechanism walkthrough, distractor teardowns, per-lesson practice, a
flip-condition transfer drill, and a proctored exam mode. Everything works
agent-less through the page UI — the agent is an interface, not a dependency.

## Implementation notes (the scars)

We probed the runtimes before trusting any documentation, live at
https://learn.powerplatform.fyi/spike:

- `document.modelContext` only — `navigator` is deprecated and absent in
  ChatGPT's runtime.
- ChatGPT exposes **no `toolchange` events** — so the registry runs on
  `getTools()` polling, and gate-crossing tool *responses* announce surface
  changes ("advance_module is now available — re-check this page's tools").
  When the protocol gives you no push channel, the payload becomes the push channel.
- `getTools()`/`registerTool()` return Promises in real runtimes — our sync test
  mocks hid that until production crashed; the mocks now tell the truth, and the
  crash shape is a named regression test.
- Chromium < 153 kills in-flight executions on abort — so revocation drains
  before it aborts, always.
- We verified against the actual W3C spec that **no static manifest discovery
  exists** — and deliberately shipped none. No coverage theater.

The engine and full WebMCP surface ship as an MIT package
(`packages/mastery-gate`) — the pattern generalizes to any content site that
wants an AI coach without surrendering authority. Every layer was
cross-reviewed adversarially by a different model family than the one that
wrote it; that process found and sealed, among others, five independent
exam-escape paths and a self-serviceable mastery gate before any judge could.

## What's next

The remaining designed lessons, more certification tracks, and the Mastery
Debrief: a personalized end-of-module film assembled from the learner's own
ledger — directed by the agent through `compose_debrief`, validated against the
ledger by the engine, and narrated live by the learner's own coach.
`[PENDING — include only if the Day-6 graft ships]`

---

### Devpost form field mapping
- **Use-case fit for WebMCP** → "Why this is a WebMCP problem"
- **Improved user experience** → "The learner experience" + refusal/diagnosis beats
- **Collaborative capabilities** → "The collaboration: a panel of two"
- **Implementation description** → "Implementation notes (the scars)"
