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

## 7. Transparency + Memory pass — approved 2026-08-28 (expanded and locked 2026-08-28 night), runs immediately after this pass ships

Consolidates the research-brief riders AND the agent-memory leverage thread,
owner-approved in full. Own branch, Grok-build/Forge-review/ship. Adds ISC-67…69
and ISC-73…75. (Id note, 2026-08-28 ship merge: this section was drafted as
ISC-67…72, but the ACTOR pass had already claimed ISC-70/71 for the response-hint
and description-audit items — they are implemented, tested, and ticked in the ISA,
the append-only id registry. The un-started items here renumber to 73…75.)
Everything else from the gap lists stays post-contest roadmap (incl. the
`get_due_reviews` tool — the zero-build spacing line below covers the contest).

**A. Glass-box riders (ISC-67…69)**
1. **Learner-facing misconception map** (ISC-67, ≈0.5–1d): "Your model" panel on
   the hub rendering misconceptionFires WITH the evidencing questions (evidence,
   not badges — Long & Aleven's calibration caveat). The learner sees exactly
   what get_learner_state shows the agent.
2. **Export / clear my data** (ISC-68, ≈0.25d): JSON download of mastery-gate:v1
   + one-tap erase with confirmation. Copy: "your data never leaves your browser."
   Pairs deliberately with the map: here is my model of you; here is the button
   that destroys it.
3. **Success-card myth-naming** (ISC-69, tiny): correct-answer rationale names
   which distractor-myth it defeats.

**B. Dual-profile riders (ISC-73…74)**
4. **Agent report card, minimal** (ISC-73, ≈0.25d): ledger logs the agent's
   confidence hints and rubric proposals against outcomes; one calibration line
   in the "Your model" panel and in the debrief data ("coach said high-confidence
   on questions missed N%"). Deterministic; never touches routing or the gate.
5. **Profile-annotated descriptions, lite** (ISC-74, ≈0.5d): at REGISTRATION time
   (never mid-session churn), 2–3 tool descriptions gain profile-composed
   suffixes for returning learners (e.g. get_hint notes the learner's repeated
   misconception names). Demo-tested before demo-claimed.

**C. Memory contract (ISC-75, ≈0.5d total)**
6. Schema: get_learner_state exposes coachingNotes; log_coaching_note gains
   kind: observation|preference|context; **answer-cache guard** — deterministic
   rejection of notes containing question/option id patterns (ml\d+-q\d+) or long
   verbatim substrings of option text (notes replay next session and must never
   become a key stash).
7. Description surgery (drafts agreed 2026-08-28, see session log): get_learner_state
   ("read this first, every session — including coaching notes from previous
   sessions"); log_coaching_note (durable observations about HOW this learner
   learns; never answer content); get_hint + get_misconception_brief (ground in
   the learner's world); set_lesson_aim (connect aim to known goals).
8. Kickoff-prompt memory clause + three technique lines (all prompt-layer):
   - MEMORY: "You likely already know this learner — use it; ground examples in
     their real work. Start by reading get_learner_state. Deposit durable
     observations via log_coaching_note. Nothing you remember overrules the engine."
   - SPACING: "At session end, compute when they should return for spaced review
     (~1d, then 3d, then 7d after material resolves), tell them, offer to remember it."
   - DIFFICULTY: "When the site refuses — withheld answer, locked hint tier,
     closed gate — explain why that friction serves this learner."
   - TRANSFER: "Once per lesson, pose one what-if from the learner's own work
     applying the governing rule."

## Sequencing

micro-lessons lane ships → state-machines workflow resumes (surface stage
retargeted at the new architecture) → this pass (one branch, Grok build + Forge
review, same pattern). Devpost writeup gains the pedagogy paragraph: "aim,
compress, test, own, run — enforced by protocol design rather than prompt hope."
