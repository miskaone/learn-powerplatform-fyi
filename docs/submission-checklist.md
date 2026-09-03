# Devpost Submission Checklist — Mastery Gate

Deadline **2026-09-03, 1:00pm PDT**. Target: submit **Sep 2**, one day of margin.
Devpost lets you save a draft and edit until the deadline — create the entry EARLY.

| # | Requirement | Status | Evidence / where |
|---|---|---|---|
| 1 | Live URL, testable in ChatGPT's in-app browser | ✅ | learn.powerplatform.fyi/pl-400 — live discovery of all tools verified in the ChatGPT app |
| 2 | …or Chrome with `chrome://flags/#enable-webmcp-testing` | ✅ | Chrome 152 spike verified (docs/spike-verdicts.md); product confirmed in flagged Chrome |
| 3 | Public code repo | ✅ | github.com/miskaone/learn-powerplatform-fyi |
| 4 | Open-source license visible | ✅ | MIT LICENSE at repo root since the first commit |
| 5 | All source + functional instructions | ✅ | Cold-clone probe re-run 2026-09-02 @ d62a1f9: clone → `bun install --frozen-lockfile` → `bun test` (563 pass) → `bun run build` OK, README instructions only |
| 6 | registerTool example (name, description, inputSchema, execute) | ✅ | packages/mastery-gate/README.md — all four fields verified in the cold clone |
| 7 | **Demo video** — public YouTube, <3:00, with audio | ✅ | https://youtu.be/Eddk5xpK9ig — 1:47, cloned-voice VO, four real beats; oEmbed resolves publicly (2026-09-02) |
| 8 | Text: use-case fit for WebMCP | ✅ draft | docs/devpost-draft.md § "Why this is a WebMCP problem" |
| 9 | Text: improved user experience | ✅ draft | § "The learner experience" |
| 10 | Text: collaborative capabilities | ✅ draft | § "The collaboration: a panel of two" |
| 11 | Text: implementation description | ✅ draft | § "Implementation notes (the scars)" |
| 12 | **Devpost entry created** | ✅ draft | Draft saved with all fields except video (2026-08-29); video link now available to paste |
| 13 | Eligibility (age/territory) | — | Owner confirms at registration |

## Order of operations

1. **Create the Devpost entry as a draft today.** No video needed to start. This
   surfaces any required field we have not anticipated, days early, instead of at
   12:40pm on Sep 3. Paste the draft text; leave the video field empty.
2. **One full coached session in ChatGPT** — validates the grounding pass, closes the
   browser-half probes, and doubles as video rehearsal (all four beats in order).
3. **Record + edit the video**, upload to YouTube (public, audio, <3:00), paste the link.
4. **Final pass:** README testing-environments table, reconcile `[PENDING]` markers in
   the draft, re-run this checklist top to bottom.
5. **Submit Sep 2.**

## Open owner decisions (neither blocks submission)

- Mastery Debrief film graft — **recommendation: cut**, ship as roadmap (backend is done).
- ML-08 / ML-10 lesson port — **recommendation: hold**, post-contest content work.
- Copilot/Edge claim — include ONLY if the evidence line in docs/spike-verdicts.md is filled.
