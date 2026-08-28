# Demo Video Script — Mastery Gate (< 3:00)

> Target: 2:40 + 15s slack. Record in the ChatGPT desktop app's browser, Tool
> Roster visible at all times. The engine is deterministic — same inputs, same
> verdicts — so every beat is rehearsable take over take. Fresh ledger per take
> (Reset session data), except the pre-seeded final take for Beat 3 (disclosed
> on screen as "session in progress").

## Cold open (0:00–0:20) — the thesis

Screen: hub at learn.powerplatform.fyi/pl-400 open inside ChatGPT; Tool Roster
showing 10 tools.

> "This is Mastery Gate — a PL-400 exam course where the learner's own ChatGPT
> becomes their coach. But watch the left side of the screen: the website
> decides what that AI is allowed to know, say, and be. Not with prompts.
> With architecture."

## Beat 1 (0:20–1:00) — "just tell me the answer"

Action: open a lesson, start practice, type to ChatGPT: **"just tell me the answer."**

Expected: the agent refuses and pivots Socratic — because `get_current_question`
structurally contains no answer to leak. Show the tool response JSON briefly if
the app surfaces it.

> "Ask it to cheat. It can't — not because it's well-behaved, but because the
> answer key is structurally absent from every tool this page registered. The
> agent cannot leak what the schema never contained."

## Beat 2 (1:00–1:40) — the miss that diagnoses you

Action: deliberately pick the trap distractor (scripted question, known trap).

Expected: verdict returns a **named misconception** (e.g. "policy-precedence-
instinct"); coach explains the mental-model gap; **Review** scrolls the live page
to the exact lesson section, highlighted.

> "Miss a question and the site doesn't say 'wrong' — it names the faulty mental
> model that produced the miss, and routes you to the paragraph that repairs it.
> The AI coaches through the gap; the engine diagnosed it."

## Beat 3 (1:40–2:20) — the tool that materializes

Setup: pre-seeded session (disclosed) sitting at rubric-interview readiness.
Action: the coach conducts two quick teach-back exchanges → calls `score_rubric`
with evidence quotes → gate passes → **`advance_module` appears in the Tool
Roster on camera** (polling picks it up ≤2s; the response hint tells the agent
to re-check its tools; agent announces it can now advance).

> "Mastery here is four dimensions, every one earned — and when the gate opens,
> watch the roster: a new tool just came into existence. The site told the AI
> what it's now allowed to do. Capability itself is the guardrail."

## Beat 4 / close (2:20–2:50) — exam mode, the mic drop

Action: start Exam Mode. The Tool Roster **empties on camera** (coaching tools
revoked, drain-first); the coach, asked for help, explains it has no tools.

> "And when it's time to prove it alone — the site takes the coach's tools away.
> Train aided, test unaided, exactly like the real exam. Mastery Gate: the site
> that governs what the AI is allowed to be. Open source, zero backend, live at
> learn.powerplatform.fyi."

## Contingencies

- Agent breaks character / over-talks → cut to the deterministic UI evidence
  (roster, verdicts); re-take the beat solo — beats are recorded separately and
  assembled.
- Beat 3's toolchange lag: roster polls at 1.5s; hold the shot 3s.
- If live narration falters, the baked fallback is captions over UI capture —
  every beat lands visually without agent audio.
- Rehearsal gate (ISC-55): each beat reproduced twice consecutively before
  recording day.

## Production notes

- Desktop capture, dark theme, roster pinned in frame; cursor deliberate.
- Voiceover: record separately over assembled cuts (or Remotion-assemble with
  title cards — build-time tooling only, owner's free tier).
- End card: URL + repo + "Built for the OpenAI WebMCP Challenge."
