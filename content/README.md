# Content

Lesson copy, the instrumented question bank, misconception taxonomy, and
Flip-Condition scenarios for Mastery Gate live in this directory.

**License:** everything under `content/` is [CC BY 4.0](./LICENSE). Source
code in the rest of the repository is MIT.

---

## LOUD NOTE — ALL CURRENT CONTENT IS PLACEHOLDER

Every title, prompt, rationale, lesson body, and scenario in `content/pl-400/`
is **SAMPLE — replace with authored content**. Nothing here is real PL-400
exam-bank material. The files exist so the engine, validator, and Flip-Condition
tables have a shape to load. Replace every SAMPLE marker before shipping.

---

## Layout

```
content/
  LICENSE
  README.md                  ← this file
  pl-400/
    manifest.json            ← ContentManifest (answer keys live here)
    lessons/
      *.md                   ← one markdown lesson per objective
    flip-conditions/
      *.json                 ← FlipConditionScenario tables
```

## Manifest format

`content/pl-400/manifest.json` conforms to the `ContentManifest` interface in
`packages/mastery-gate/src/schema.ts`.

- `courseId` / `title`
- `objectives[]` — each has `id`, `title`, `summary`, `questionIds`
- `questions[]` — each has `id`, `objectiveId`, `concepts`, `prompt`,
  `options`, `correctOptionId`, `rationale`, `remediationAnchor`
- `misconceptions[]` — each has `id`, `name`, `contrast`, `socraticSeeds`,
  `anchor`

Option rules (enforced by `scripts/validate-content.ts`):

- Every **distractor** option carries `misconceptionId`.
- The **correct** option carries none.
- `correctOptionId` matches exactly one option.
- Every `misconceptionId` resolves in `manifest.misconceptions`.

The manifest is the **only** place answer keys live. That is authoring-side
and intentional. Tool schemas never receive this file; the engine redacts
before anything crosses the WebMCP boundary.

## Lesson anchor syntax

Lesson markdown uses heading anchors of the form:

```markdown
## Section title {#section-id}
```

`question.remediationAnchor` and `misconception.anchor` values **must** match
one of these `{#section-id}` tokens. Flip-Condition row `citation` values
must too.

The extractor is the regex `/\{#([A-Za-z0-9_-]+)\}/g` over every
`content/pl-400/lessons/*.md` file.

## Flip-Condition decision tables

Scenarios live in `content/pl-400/flip-conditions/*.json` and match the
`FlipConditionScenario` shape in
`packages/mastery-gate/src/rules/flipCondition.ts`:

- `id`, `title`, `treeKind` (`ui` | `automation`)
- `baselineRowId` — must be one of `rows[].id`
- `rows[]` — each row has `id`, `answers` (question-node id → boolean),
  `expectedOutcomeId`, `expectedComponent`, `expectedRuleId`, `citation`
- The baseline row must **not** set `mutatedQuestionId`
- Every other row sets `mutatedQuestionId` to the **single** question id
  whose answer differs from the baseline

`answers` may cover the whole tree. `citation` is a lesson section id.

## How to validate

From the repository root:

```sh
bun scripts/validate-content.ts
```

The root package script `validate:content` is to be wired by integration.
The validator prints ids and error messages only — never answer keys,
rationale text, or option→misconception mappings.
