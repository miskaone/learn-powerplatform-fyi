# ACTOR Pass — approved 2026-08-27, runs after the micro-lessons lane ships

Owner-approved extraction from the ACTOR framework (Aim, Compress, Test, Own, Run;
AI as sparring partner, never summarizer). Test is already the engine's core; the
pieces below add the missing steps. Implementation adds ISC-62…65 to the ISA
(append-only ids) when this pass starts.

## 1. Aim — `set_lesson_aim` (≈0.5d) → ISC-62

- New tool `set_lesson_aim` (+ page input for agent-less parity): the learner
  states "I'm reading this because I need to ___" at lesson start.
- Ledger-persisted (clamped ~200 chars, validated non-empty), exposed through
  `get_learner_state`, excluded from the evidence corpus.
- The tool DESCRIPTION invites the agent to open every session by asking for the
  aim — the coach's first question is "why are you here?", by protocol design.

## 2. Compress — commit-the-rule (≈0.5d) → ISC-63

- After the scenario, before practice: "State this lesson's load-bearing rule in
  one line" — the same commit-then-reveal interaction the lesson template uses,
  pointed at the governing rule. Reveal shows the authored rule for comparison.
- Learner's line persisted per lesson; the coach critiques it against the real
  rule text ("what did you miss or overstate?") — engine-approved content only.

## 3. Run — commitment field (≈0.25d) → ISC-64

- Lesson end: "One thing I'll do with this — a decision, a checklist line, or an
  experiment." Persisted per lesson, specificity demanded (methodology P6).
- The Mastery Debrief graft replays these commitments as its closing segment.

## 4. Own — prompt-layer only (free) → ISC-65

- Kickoff prompt + misconception-brief socratic seeds gain one demand: before
  advancing, the learner explains the concept back in their own words.
- No new tools; tool descriptions are the enforcement surface.

## Sequencing

micro-lessons lane ships → state-machines workflow resumes (surface stage
retargeted at the new architecture) → this pass (one branch, Grok build + Forge
review, same pattern). Devpost writeup gains the pedagogy paragraph: "aim,
compress, test, own, run — enforced by protocol design rather than prompt hope."
