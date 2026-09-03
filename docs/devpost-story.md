# Devpost Story — Mastery Gate (final, 2026-09-02, no dashes)

> Pasted into the Devpost "Project Story" fields as-is. Source of truth for
> claims: docs/spike-verdicts.md, docs/research/*, ISA.md.

## Inspiration

Every AI study tool has the same fatal flaw: ask it nicely and it gives you the
answer. That's homework theater, and the research says it's worse than useless.
Learning science is unambiguous: **retrieval practice beats re-reading**,
feedback works when it names *why* you were wrong, and desirable difficulties
(the friction) are where retention comes from. The AI-tutoring RCTs agree from
the other direction: constrained Socratic tutors roughly double learning
(Kestin et al. 2025), while unguarded chatbot access makes students *worse* once
the aid is removed (Bastani et al. 2024). The guardrails are the active
ingredient, and prompts are guardrails an AI can be talked out of.

WebMCP made a different kind possible: **architecture**. The page owns the
tools, so the site decides what the AI may know, say, and be. I had already
built this pedagogy once without AI, with deterministic scoring, named
misconceptions, and repair routes, for my daughter's engineering statics course.
Mastery Gate is what that pattern becomes when you hand it to an agent.

## What it does

Your own ChatGPT becomes a Socratic coach for Microsoft's PL-400 exam, and the
site is the referee it cannot overrule.

- A deterministic TypeScript engine grades, counts attempts, diagnoses **named
  misconceptions** (a miss returns "policy-precedence-instinct", never the key),
  scores a four-dimension mastery rubric (Recall, Connections, Application,
  Transfer, every dimension at 3 or above, never an average), and gates
  progression.
- The agent coaches through the page's WebMCP tools: Socratic questioning, an
  earned hint ladder, remediation routed to the exact lesson paragraph. Ask it
  for the answer and it refuses, leading with the reason (the answer is in no
  tool it can call), then asks one smaller question instead.
- **Capability is the guardrail.** `advance_module` does not exist until the
  gate opens; it materializes in the agent's tool list when mastery is earned.
  Exam mode revokes the coaching toolset entirely: train aided, test unaided.
  On screen, the Tool Roster reads **13 tools with the gate closed, 15 when it
  opens, 2 during the exam**. The site's decisions are visible to learner and
  agent alike.
- The **rubric interview** is the centerpiece. The engine's own routing hands
  the mic to the AI to judge free-form teach-back explanations, then validates
  its scores against verbatim lesson-text evidence and clamps them. The AI does
  what only AI can; the site does what AI must not.
- Zero AI infrastructure: static site, no backend, no API keys. The visitor
  brings the intelligence; the site brings the authority. Everything also works
  agent-less. The coach is an interface, not a dependency.

## How we built it

A pure-TypeScript engine (MIT, `packages/mastery-gate`) under a Next.js static
export on Cloudflare Pages; the learner's state lives in localStorage and never
leaves the browser. The lesson content is instrumented deeply: 34 questions
across two PL-400 objectives, every distractor tagged to a 17-misconception
taxonomy, remediation anchors into the exact authored sections. Two
evidence-graded research briefs live in the repo mapping each mechanism to the
learning-science literature. And every layer was **adversarially cross-reviewed
by a different model family than the one that wrote it.**

## Challenges we ran into

- **We probed the runtimes before trusting documentation**, live at `/spike`.
  ChatGPT's runtime has no `toolchange` events; Chrome does. The registry
  feature-detects, and gate-crossing *responses* announce new tools. When the
  protocol gives you no push channel, the payload becomes the push channel.
- `getTools()` and `registerTool()` return Promises in real runtimes; our
  lenient mocks hid that until production crashed. Chrome also enforces
  `executeTool(RegisteredTool, jsonString)` strictly. The mocks now tell the
  truth, and each crash shape is a named regression test.
- **The subtlest bug was pedagogical.** Early on we redacted so hard the coach
  had no curriculum. It refused to leak answers, then taught from its own
  pretraining, probing about scenarios the learner had never seen. The fix
  became our design law: **the agent gets exactly what a learner reading the
  page gets, no more and no less.** Redaction is symmetry, not secrecy.
- **The host moved under us (Aug 28 to Sep 2).** The ChatGPT desktop app's
  plugin update broke its own browser bridge (a missing `scripts/` dir in the
  cached skill), then native page-tool injection into conversations turned
  intermittent, and a long session tripped an undocumented
  **10-changes-per-page-load** budget on the tool surface, read straight from
  the app's `browser-service.mjs` (`max_tools` 100,
  `max_total_descriptor_bytes` 65,536, `max_registration_changes` 10). None of
  it was the page; Chrome 152's reference runtime returned every tool
  throughout. But a coach that stalls on a host quirk is a bad coach, so the
  kickoff self-heals all three: it falls back to the app's own WebMCP bridge
  (same registered tools, different transport), corrects the
  `tools.call(name, input)` convention, and refreshes the tab when the budget
  is spent, saying so in one line each time.
- We surveyed five agent surfaces and found only two can invoke page tools
  today (ChatGPT's desktop browser, Chrome 152 with the flag); three read but
  cannot call. The ecosystem gap is real. See What's next.

## Accomplishments that we're proud of

- The first live coached session: the agent read its tool descriptions and
  **volunteered "I will not reveal or submit the answer", unprompted.** The
  descriptions are its employment contract, and it signed. In the demo it
  refuses on camera.
- Cross-family adversarial review found and sealed, before any judge could:
  five independent exam-escape paths, a self-serviceable mastery gate (an agent
  quoting the question back as "evidence" to award itself 4/4/4/4), and an
  answer-cache side channel through coaching notes.
- The site reacts to its own state instead of asking the agent to. A miss
  scrolls the page to the repairing paragraph, a gate change updates the
  roster, and `start_exam` mounts the exam where the learner is standing. The
  page moves; the chat stays put. And when the interview isn't unlocked yet,
  the referee says *why*: `request_next_action` returns the per-dimension
  coverage ledger, so "not yet" always comes with "here's what's missing."
- A **Tool Inspector** on the page: schema-generated forms for every registered
  tool, so anyone in any browser can invoke the real surface, with the same
  guards and the same redaction, and no agent at all.
- A "Your model" panel showing the learner exactly what the agent sees (the
  misconception ledger with its evidence) next to a one-tap erase. Glass box,
  both directions.

## What we learned

You cannot make a chatbot answer-proof with a prompt; the learner can always
rewrite it. You can make it answer-proof with a tool surface. We learned that
the hard way on our own machine: a tutoring skill installed in ChatGPT quietly
announced a "direct-answer mode" and handed over an answer, outranking the
pasted contract. Host-level instructions beat prompts every time. But even then
the engine leaked nothing. The skill could only read what the page shows every
learner. The kickoff now claims precedence over installed coach skills; the
*gate* never needed to.

And starving the agent is not governing it: the coach teaches best when it
holds exactly the learner's page, nothing more. The future of the open web isn't
agents driving websites. It's **websites that stay authoritative while agents
make them personal.**

## What's next for Mastery Gate

- **The bridge** (in-repo companion, tested; live pairing is roadmap): an MV3
  extension plus a local MCP server so *any* MCP-speaking client, CLI agents
  included, can invoke a page's WebMCP tools. Three of the five surfaces we
  surveyed need exactly this.
- The remaining designed lessons and more certification tracks; spaced-review
  scheduling keyed to the misconception ledger; concept-level deep links.
- The **Mastery Debrief**: an end-of-module film assembled from the learner's
  own ledger, directed by the agent, validated by the engine, narrated live by
  the coach (backend shipped; the film is roadmap).
- When WebMCP's service-worker proposal lands, the ledger becomes an
  always-available origin service: your coach checks what's due for review
  without the site even being open.
