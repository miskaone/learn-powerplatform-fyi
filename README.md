# Mastery Gate — learn.powerplatform.fyi

**The site that governs what the AI is allowed to be.**

An adaptive PL-400 learning course where a unit-tested, deterministic TypeScript
engine — not prompts — decides what a visiting agent (the learner's own ChatGPT,
via [WebMCP](https://github.com/webmachinelearning/webmcp)) is allowed to know,
say, and be at every moment: answer keys are redacted at the tool boundary, and
the agent's tools are registered and revoked as the learner earns mastery.

Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/). Live at
[learn.powerplatform.fyi/pl-400](https://learn.powerplatform.fyi/pl-400) —
companion to the [powerplatform.fyi](https://powerplatform.fyi) field guide.

## How it works

- **The site decides; the agent teaches.** Grading, misconception diagnosis,
  the four-dimension mastery rubric (Recall · Connections · Application ·
  Transfer, every dimension ≥3 to pass — never an average), and next-step
  routing are deterministic engine verdicts. The agent supplies explanation,
  Socratic questioning, and coaching craft.
- **Capability is the guardrail.** `advance_module` does not exist until the
  mastery gate opens. Exam mode revokes the coaching toolset. The agent cannot
  be talked into tools that aren't registered.
- **Redaction beats instruction.** Tool response schemas structurally omit
  answer keys — the agent cannot leak what the schema never contains.
- **Bring your own agent.** The site holds no API keys, calls no models, and
  runs no backend. The visitor's agent is the intelligence; the site is the
  authority. Everything also works agent-less via the page UI.

## Layout (planned)

- `packages/mastery-gate/` — the deterministic learning engine + WebMCP tool
  surface. Pure TypeScript, unit-tested, zero dependencies on the app.
- `apps/web/` — the Next.js static-export site consuming the engine.
- `content/` — instrumented PL-400 lesson content and question banks
  (misconception-keyed distractors, remediation anchors). Licensed CC BY 4.0.

## Build contract

- **bun only** — never npm/npx. `bun install`, `bun run build`, `bun test`.
- **Static export** — Next.js `output: "export"`, build output in `out/`.
- **Deploy** — push to `main` builds on Cloudflare Pages and serves at
  `learn.powerplatform.fyi`. No CI deploy workflows; the git integration is
  the only deploy path.

## License

Code is [MIT](LICENSE). Lesson content under `content/` is
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
