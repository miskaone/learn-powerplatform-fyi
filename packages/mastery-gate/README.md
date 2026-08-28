# @learn/mastery-gate

**The deterministic referee behind [learn.powerplatform.fyi/pl-400](https://learn.powerplatform.fyi/pl-400).**

A pure-TypeScript learning engine plus a [WebMCP](https://github.com/webmachinelearning/webmcp)
tool surface. The engine — not a prompt — decides what a visiting agent is
allowed to know, say, and be at every moment of a learning session. No React,
no network calls, no backend: all learner state lives in `localStorage` behind
a validating storage adapter.

## The four ideas

### 1. The site decides; the agent teaches

Grading, misconception diagnosis, attempt counting, the hint ladder, the
four-dimension mastery rubric (Recall · Connections · Application · Transfer —
every dimension ≥ 3 opens the gate, and there is deliberately **no averaged
mastery number anywhere in the public API**), and next-action routing are all
deterministic engine verdicts. The agent supplies explanation, tone, and
Socratic craft. Same inputs, same routing, every time.

### 2. Redaction beats instruction

Answer keys are **structurally absent** from tool responses, not politely
withheld. `QuestionPublic` is built field-by-field (`toQuestionPublic` in
`src/schema.ts`) — never by spreading and deleting — so `correctOptionId`,
`rationale`, the distractor→misconception map, and remediation targets cannot
ride along. A miss returns the **named misconception**, never the correct
option. Rubric evidence is validated against a corpus that excludes every
string the tool surface itself emits, so an agent cannot quote a tool response
back as "verbatim evidence" and self-award the gate.

### 3. Dynamic registration is the pedagogy

Tools appear and vanish as the learner earns them (`src/webmcp/registry.ts`):

- `advance_module` does not exist until every rubric dimension is ≥ 3 — its
  appearance in the agent's tool list **is** the mastery signal.
- `get_misconception_brief` registers only after the same misconception fires
  twice.
- `reveal_outcome` registers only after `commit_prediction` lands —
  commit-then-reveal enforced by tool availability, not by asking nicely.
- `start_exam` triggers **mass revocation**: the coaching toolset is
  deregistered and only `get_exam_status` / `submit_exam` survive until the
  exam is submitted (then `get_exam_debrief` appears).

A tool that does not exist cannot be talked into existing.

### 4. Drain-first revocation

Real deregistration is done by aborting the registration's `AbortController` —
but never while an execution is in flight (Chromium < 153 kills in-flight tool
calls; ChatGPT's in-app browser runs a 151 base). The registry counts in-flight
executions per tool and a revocation **waits for the drain** before aborting; a
never-settling execution marks that tool's revocation *stuck* without ever
wedging the rest of the sync. A refusal-state fallback (tools stay registered
and return proctor refusals) ships behind the same registry interface as a
one-line swap (`revocationMode: 'deregister' | 'refusal'`).

Two more contracts learned from live probes (see `docs/spike-verdicts.md`):

- **`document.modelContext` first.** ChatGPT's in-app browser injects
  `document.modelContext` only (no `navigator.modelContext`). The
  feature-detecting shim (`resolveModelContext` in `src/webmcp/model-context.ts`)
  prefers `document` and keeps `navigator` as a backward-compat fallback.
- **No `toolchange` dependency.** ChatGPT's implementation has no event
  surface. The on-page Tool Roster is driven by `getTools()` polling
  (`src/webmcp/tool-surface-watcher.ts`); `toolchange` is treated as an
  optional enhancement only. `registerTool` and `getTools` return Promises on
  real runtimes — every consumer awaits `Promise.resolve(...)`.

## Registering a tool

The registration form this package uses against the live
`document.modelContext` runtime — a descriptor with `name`, `description`,
`inputSchema`, and `execute`:

```ts
document.modelContext.registerTool(
  {
    name: "submit_answer",
    description:
      "Submit the learner's chosen option for the current question. Returns a deterministic verdict; a miss names the misconception, never the correct answer.",
    inputSchema: {
      type: "object",
      properties: {
        questionId: { type: "string" },
        optionId: { type: "string" },
      },
      required: ["questionId", "optionId"],
      additionalProperties: false,
    },
    async execute(input) {
      const verdict = facade.submitAnswer(input.questionId, input.optionId);
      return { content: [{ type: "text", text: JSON.stringify(verdict) }] };
    },
  },
  { signal: abortController.signal }, // aborting = deregistration (drain first!)
);
```

In this package the descriptors are built by `createToolset(facade)` in
`src/webmcp/tools.ts` (all 23 tools, every input validated and clamped before
it touches the engine) and registered/revoked by the phase-driven
`ToolRegistry` in `src/webmcp/registry.ts`. The host app never touches the raw
API outside the `resolveModelContext` shim.

## Tool surface

**Static (registered on page load):** `get_learner_state`,
`get_current_context`, `navigate_to_anchor`, `log_coaching_note`,
`get_current_question`, `submit_answer`, `get_hint`, `request_next_action`,
`prescribe_drill`, `score_rubric`, `set_lesson_aim`.

Every description is written as agent-facing UX: it says WHEN to call the
tool, not just what it does. Because ChatGPT's WebMCP implementation has no
`toolchange` events, **tool responses are the only push channel** — at every
registration-changing moment the response carries a `toolChangeHint` naming
what appeared or vanished (`score_rubric` gate-pass → `advance_module` +
`start_exam`; a misconception's second fire → `get_misconception_brief`;
`start_exam` → the mass revocation; `submit_exam` → the restoration +
`get_exam_debrief`). `request_next_action` can also return the
`rubric_interview` verdict: when per-dimension MCQ coverage is sufficient but
the gate has not passed, the deterministic referee hands the mic to the agent
for the one thing only it can do — judge free-form explanations — with the
interview contract (5–8 open questions, verbatim evidence per dimension)
carried in the verdict's guidance and in `score_rubric`'s description.

**Dynamic (earned):** `advance_module`, `get_misconception_brief`,
`mutate_assumption`, `commit_prediction`, `reveal_outcome`, `start_exam`,
`get_exam_status`, `submit_exam`, `get_exam_debrief`, and the Mastery Debrief
trio `compose_debrief` / `get_narration_script` / `advance_segment`.

## Schema overview

Defined in `src/schema.ts`; the redaction boundary is the split between the
full and `*Public` shapes.

| Shape | Purpose | Redaction |
|---|---|---|
| `ContentManifest` | Course bundle: `objectives`, `questions`, `misconceptions`, optional `exam` config and `flipScenarios` decision tables | Never crosses the tool boundary whole |
| `Question` → `QuestionPublic` | One bank item | Public shape drops `correctOptionId`, `rationale`, `remediationAnchor`, and per-option `misconceptionId` |
| `Misconception` | Named wrong-model: `contrast`, `socraticSeeds`, remediation `anchor` | Served only via `get_misconception_brief` after it actually fired |
| `RubricScores` | Four 0–4 dimensions | No average field exists, by construction |
| `Ledger` | Persisted learner state: attempts, misconception fire counts, scores, coach notes, phase, `drillResults`, `activeDrill`, `exam`, `debrief`, `learnerName`, and the ACTOR records `lessonAims` / `ruleCompressions` / `runCommitments` (learner-authored, per lesson, clamped, exam-guarded, never admitted to the rubric evidence corpus) | Loaded through field-by-field validation (`src/engine/storage.ts`); tampered state → clean defaults, oversized state → clamped |
| `ExamState` / `ExamVerdict` | Exam lifecycle: injected clock, duration clamped 60–7200 s, unanswered = incorrect, expiry auto-submits | Mid-exam verdicts carry `misconceptionId: null`; per-question verdicts release only in the debrief |
| `DrillSessionState` / `DrillResultRecord` | Flip-Condition drill: one mutation per round, irreversible commit, decision-table evaluation, transfer-dimension ledger record | Outcome unreachable before `commit_prediction` |
| `DebriefState` / `NarrationCue` | Mastery Debrief playlist; segments rejected unless their misconception actually fired in the ledger | `getNarrationScript` returns only engine-approved lines |

Engine entry points: `MasteryEngine` (`src/engine/engine.ts`) and the
`EngineFacade` adapter (`src/webmcp/engine-adapter.ts`) the tools delegate
through.

## Using the package

```ts
import { MasteryEngine, LocalStorageAdapter } from "@learn/mastery-gate/engine";
import {
  MasteryEngineFacade,
  ToolRegistry,
  createToolset,
  resolveModelContext,
} from "@learn/mastery-gate/webmcp";

const engine = new MasteryEngine(manifest, new LocalStorageAdapter());
const facade = new MasteryEngineFacade(engine, manifest);
const ctx = resolveModelContext(); // document.modelContext first, else navigator
if (ctx) {
  const registry = new ToolRegistry(ctx, facade);
  await registry.sync(facade.getRegistrySnapshot()); // registers the earned set
}
```

Every engine path is equally drivable without an agent — the site's page
buttons call the same facade. WebMCP is an interface to the product, not the
product's pulse.

Tests: `bun test` (engine + tool surface + registry, deterministic, injected
clocks — no timers, no `Date.now`). Typecheck: `bun run typecheck`.

## Roadmap: Coachable Docs

Mastery Gate treats one PL-400 course as its content, but nothing in the
engine knows about Power Platform. The manifest — objectives, questions with
misconception-keyed distractors, remediation anchors into prose, decision-table
drills — is a compile target. The ambition:

- **Author in your docs.** Annotate any documentation set (product docs, a
  runbook, an internal wiki) with objectives, question banks, and named
  misconceptions; a compiler emits a `ContentManifest`.
- **Ship the referee with the docs.** Any page that loads the manifest and
  registers the toolset becomes a site that coaches — visitors bring their own
  agent, the site brings the authority: redacted delivery, deterministic
  grading, mastery gating, and tool revocation, with zero backend and zero API
  keys.
- **Keep the pedagogy in the capability layer.** The same dynamic-registration
  grammar (earn `advance_module`, lock `reveal_outcome` behind commitment,
  revoke coaching during assessment) applies to any subject matter.

The engine stays extractable by design: this package has no imports from the
app, and the app consumes it only through the public exports.

## License

MIT (see the repository root `LICENSE`). Lesson content under `content/` is
CC BY 4.0.
