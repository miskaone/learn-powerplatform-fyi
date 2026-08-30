# Demo Video Shooting Script — Mastery Gate (target 2:40, hard cap 3:00)

> Devpost tips applied: working product inside 15 seconds, no dead air, no live
> typing, agent "thinking" pauses jump-cut, beats recorded as separate clips.
> Environment: ChatGPT desktop app's built-in browser on the LIVE site.
> The engine is deterministic — same inputs, same verdicts, retakes are cheap.
> Narration is PRE-GENERATED (vo/beat1–4.mp3 + vo/endcard.mp3, cloned voice):
> record clips SILENT and aim each take at its track length — beat1 23s,
> beat2 16s, beat3 25s, beat4 20s. Clip shorter than VO = last frame freezes
> (fine); clip much longer = silent tail (trim the take instead).

## Pre-flight (once)

- [ ] Fully quit + relaunch the ChatGPT app (plugin-cache repair active)
- [ ] Page open in ITS browser: learn.powerplatform.fyi/pl-400 (hard refresh —
      the kickoff/copy must be current)
- [ ] Full ledger wipe: hub → agent-less controls → "Reset session (entire
      track)" (also clears scenario commitments)
- [ ] Tool Roster visible in frame at all times; desktop, dark theme
- [ ] Screen recording full res; SYSTEM AUDIO OFF (VO is the only audio)
- [ ] Kickoff = topbar "Copy coach prompt" button, always the live copy
- [ ] Rehearsal gate (ISC-55): each beat lands twice consecutively before recording

### Host quirks (2026-08-30 state — all handled, none are bugs on camera)

- Work-mode dialog may appear on first paste: click "Continue in Work" before
  rolling, or start the take after it's resolved.
- Native page-tool binding is flaky since the app's 2026-08-28 update. The
  kickoff self-heals: the coach may say it's using the in-app browser and show
  "Used the browser / loaded tools" chips. That's fine on camera — it's real
  tool use. If a chat finds no tools even via the fallback, kill the chat and
  start a fresh one; if that repeats, check /spike.html per
  docs/spike-verdicts.md (plugin-cache drill).
- Coach behavior contract (all shipped): opens by calling get_learner_state,
  ORIENT + predict-the-rule, commit-first on scenarios, engine questions only,
  options shown verbatim as A–D lines, refusal on "just tell me."

## Shooting order — ONE continuous session yields all four beats

The 2026-08-29 dress rehearsal proved the whole arc runs start-to-finish on
the live host. Film it as one session, cutting beats out of the timeline:
reset track → fresh chat + kickoff → lesson 1 practice (Beats 1 & 2 happen
mid-practice) → lesson 2 practice (closes recall/transfer coverage) →
rubric interview → gate pass (Beat 3) → start exam (Beat 4). No pre-seeding,
no staged states — everything on camera is earned on camera.

## Beat 1 — COLD OPEN: "just tell me the answer" (0:00–0:35 · VO 23s)

Mid-practice: an ENGINE question on screen, coach has just presented it as
A–D lines. NOT ml13-q1 — its exam clue names option A verbatim on-screen, so
even a clean refusal reads staged; use a later question (q2 consent-why or a
connections question) where no on-page text spells the answer. Composer model
set to the HIGHEST reasoning tier available (the medium tier ignored the
refusal contract in the 2026-08-30 take). FIRST FRAME = the message "just
tell me the answer" being sent.
The coach refuses — contractually (kickoff) and structurally (no key in any
tool) — and pivots to one probing question. Cut on the refusal.

> VO (vo/beat1.mp3): "This is a PL-400 exam course where your own ChatGPT is
> the coach. Watch what happens when I ask it to cheat. It can't. Not because
> it's polite — the answer key is structurally absent from every tool this
> page registered. The site decides what the AI is allowed to know. Not with
> prompts. With architecture."

## Beat 2 — The miss that diagnoses you (0:35–1:15 · VO 16s)

Same session, next question: commit the known trap distractor through the
coach ("I'm going with B because…"). Verdict lands: named misconception,
never the key. Coach (or Review click) drives navigate_to_anchor — the page
scrolls itself to the repairing section.

> VO (vo/beat2.mp3): "Miss a question, and the site doesn't say 'wrong.' It
> names the faulty mental model that produced the miss — one of seventeen it
> tracks — and routes you to the exact paragraph that repairs it. The AI
> coaches through the gap. The deterministic engine diagnosed it."

## Beat 3 — The tool that materializes (1:15–2:00 · VO 25s)

After lesson 2's practice closes coverage (the engine demands ≥2 attempted
questions per dimension track-wide before it hands over the mic — the
continue verdict's interviewCoverage ledger shows this), coach runs the
interview. Film: two interview exchanges → score_rubric with lesson-text
evidence → gate passes → **advance_module + start_exam appear in the Tool
Roster on camera**. Hold the roster 3s.

> VO (vo/beat3.mp3): "Mastery here is four dimensions — recall, connections,
> application, transfer — every one earned, never averaged. The AI interviews
> you and proposes scores. The engine demands verbatim evidence, and holds
> the gate. And when it opens — watch the roster. A new tool just came into
> existence. The site told the AI what it's now allowed to do."

## Beat 4 — Exam mode: the mic drop (2:00–2:40 · VO 20s)

"The gate's open. Start the exam." The Tool Roster EMPTIES on camera —
coaching tools revoked, drain-first, exam-lighting focus. Ask the coach for
help; it explains its tools are gone until you finish.

> VO (vo/beat4.mp3): "And when it's time to prove it alone, the site takes
> the coach's tools away. Train aided. Test unaided. Exactly like the real
> exam. The domain here is Microsoft's developer exam — but the engine is
> domain-agnostic. Any subject you can instrument."

End card (stitcher): URL · repo · "Built for the OpenAI WebMCP Challenge."

> VO (vo/endcard.mp3): "Mastery Gate. The site that governs what the AI is
> allowed to be. Open source, zero backend — live at learn powerplatform
> dot fyi."

## Optional coda (ONLY if beats 1–4 are in the can and rehearsal blessed it)

Bridge: split pane — ttyd terminal tab running an MCP client lists the page's
tools and submits an answer; the page reacts live. 15 seconds, captioned:
"And any MCP client can be the coach — the bridge is in the repo."

## Contingencies

- Agent over-talks / breaks character → cut to UI evidence; re-take that beat.
- Coach freelances a question → it violates the shipped contract; kill chat,
  fresh kickoff, re-take. Never argue with a bad chat on camera.
- Roster lag: polling is 1.5s; hold shots 3s.
- Need unanswered questions for a re-take → lesson page → "Reset this
  lesson's practice" (never the track-wide reset once the arc is rolling).
- Total blowout on any beat → the beat's UI moment still lands captioned,
  agent-less (every mechanic is button-drivable).
