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

## 5. Rubric interview — the engine invites the agent's judgment (≈0.5d) → ISC-66

Approved 2026-08-27 ("proceed") from the owner's proxy critique: today the agent
mostly relays engine verdicts; its irreplaceable lane — judging free-form
explanations — has rails but no invitation.

- Routing addition: when MCQ coverage is sufficient (per-dimension attempt
  thresholds met but rubric unscored or any dimension <3), `request_next_action`
  returns a new verdict `rubric_interview` — the deterministic referee explicitly
  hands the mic to the agent for the part only AI can do.
- `score_rubric`'s description + the kickoff prompt describe the interview
  contract: 5–8 open questions across recall/connections/application/transfer
  (one at a time, never answering for the learner), then submit dimension scores
  WITH verbatim evidence quotes from the lesson corpus grounding each judgment.
  Engine validation unchanged: attempts precondition, corpus check, clamping,
  every-dimension-≥3 gate.
- Agent-less parity: the page offers a self-assessment path to the same
  `score_rubric` engine call (existing demo-rubric control, relabeled honestly).
- Devpost line this enables: "the AI does what only AI can — understand
  explanations and adapt teaching; the site does what AI must not — grade, gate,
  and certify. The rubric interview is where they meet."

## 6. Adopted from the 2026-08-27 feature-surface review (external) → folded here

Disposition of that review, verified before adoption:
- **REJECTED — static `/.well-known/model-context.json` manifest**: verified against
  webmachinelearning.github.io/webmcp — the spec defines NO static discovery
  mechanism (runtime JS API + implementation-defined browser observation only).
  The package README is the tool-contract documentation. Do not build manifest theater.
- **ADOPTED — gate-crossing response hints (≈0.25d)**: ChatGPT gets no toolchange
  events, so tool responses at registration-changing moments append a hint —
  `score_rubric` gate-pass response says "advance_module is now available —
  re-check this page's tools"; misconception second-fire responses mention
  get_misconception_brief; exam start/submit responses name the revocation/
  restoration. The response channel is the agent's only notification channel.
- **ADOPTED — tool-description audit (≈0.25d, highest leverage)**: read every one
  of the 22 descriptions as agent-facing UX; each must say WHEN to call, not just
  what it does; fold the ACTOR/interview contracts into the relevant ones.
- **ADOPTED — stuck-revocation UI badge (small)**: surface getStuckRevocations /
  onStuckRevocation in the Tool Roster (exam-start depends on revocation settling).
- **NOTED — ISC-25 rewording**: acceptance = registration visible via getTools/
  roster polling (events optional), matching the judge environment's reality.
- Stale items (no action): "no agent detected" roster copy already ships both
  states; quarantined debrief tools are the Day-6 graft decision (Aug 31), with
  backend + tests landing in the state-machines lane.

## 7. Transparency pass — approved 2026-08-28, runs immediately after this pass ships

From the research briefs' gap analyses (docs/research/), owner-approved as the one
contest-window addition; everything else in those gap lists is post-contest roadmap.
Own branch, same Grok-build/Forge-review/ship pattern. Adds ISC-67…69.

1. **Learner-facing misconception map** (ISC-67, ≈0.5–1d): a "Your model" panel on
   the hub rendering the ledger's misconceptionFires with the evidencing questions
   (evidence, not bare badges — Long & Aleven's calibration caveat). The learner
   sees exactly what get_learner_state shows the agent: the glass-box completion.
2. **Export / clear my data** (ISC-68, ≈0.25d): JSON download of mastery-gate:v1 +
   one-tap erase with confirmation. Copy: "your data never leaves your browser."
3. **Success-card myth-naming** (ISC-69, tiny): correct-answer rationale names the
   distractor-myth it defeats (feedback-after-success, Hattie & Timperley).

## Sequencing

micro-lessons lane ships → state-machines workflow resumes (surface stage
retargeted at the new architecture) → this pass (one branch, Grok build + Forge
review, same pattern). Devpost writeup gains the pedagogy paragraph: "aim,
compress, test, own, run — enforced by protocol design rather than prompt hope."
