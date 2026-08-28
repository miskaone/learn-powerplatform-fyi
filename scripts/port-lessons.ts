/**
 * port-lessons.ts — deterministic converter from the authored PL-400
 * micro-lesson spec format to the Mastery Gate ContentManifest schema.
 *
 * Usage:
 *   bun scripts/port-lessons.ts <lesson-spec-dir>
 *   LESSON_SPEC_DIR=<dir> bun scripts/port-lessons.ts
 *
 * Reads the five lesson spec JSON files (shape: {schemaVersion, lesson:{...}})
 * from the source directory (read-only; never modified) and writes:
 *   - content/pl-400/manifest.json        (objectives, questions, misconceptions)
 *   - content/pl-400/lessons/<slug>.md    (lesson prose with {#anchor} ids)
 *   - content/pl-400/lesson-sections.json (UI section list; imported by apps/web/lib/content.ts)
 *   - content/pl-400/lesson-pages.json    (per-lesson rich page data consumed by the /pl-400/[slug] lesson template)
 *
 * Deterministic by construction: fixed lesson order, fixed section anchors,
 * fixed option rotation, and authored mapping tables (misconception taxonomy,
 * per-question concepts, per-distractor misconception ids) embedded below.
 * Same inputs always produce byte-identical outputs.
 *
 * NOTE on `dimension`: the frozen schema (packages/mastery-gate/src/schema.ts)
 * has no per-question dimension field. Each question in manifest.json carries
 * an extra `dimension` property ("recall" | "connections" | "application" |
 * "transfer") that the schema types do not declare — harmless at runtime (the
 * manifest is cast, redaction is field-by-field) and ignored by the validator.
 * Adding `dimension?: RubricDimension` to `Question` is proposed in
 * docs/content-port-review.md; the schema itself is NOT changed here.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Source spec types (subset actually consumed)
// ---------------------------------------------------------------------------

interface SpecQuestion {
  id: string;
  dimension: 'Recall' | 'Connections' | 'Application' | 'Transfer';
  type: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  objectiveIds: string[];
}

interface SpecConcept {
  id: string;
  label: string;
  importance: string;
  summary: string;
  relations: unknown[];
}

interface SpecDistractor {
  choice: string;
  whyTempting: string;
  whyWrong: string;
}

interface SpecVisualStep {
  label: string;
  state: string;
  detail: string;
}

interface SpecVisual {
  type: string;
  title: string;
  steps: SpecVisualStep[];
}

interface SpecDrills {
  Recall: string;
  Connections: string;
  Application: string;
  Transfer: string;
}

interface SpecReference {
  label: string;
  url: string;
  accessedDate: string;
  evidenceNote: string;
}

interface SpecLesson {
  id: string;
  slug: string;
  title: string;
  topic: { id: string; title: string };
  heroEpigraph: string;
  governingRule: string;
  examClue: string;
  mnemonic?: string;
  scenario: { prompt: string; expectedAnswer: string };
  concepts: SpecConcept[];
  distractors: SpecDistractor[];
  productionNuance: string[];
  visual: SpecVisual;
  drills: SpecDrills;
  reflection: string[];
  references?: SpecReference[];
  questions: SpecQuestion[];
}

// ---------------------------------------------------------------------------
// Output types (mirror the frozen schema, plus the extra `dimension` field)
// ---------------------------------------------------------------------------

type Dimension = 'recall' | 'connections' | 'application' | 'transfer';

interface OutOption {
  id: string;
  text: string;
  misconceptionId?: string;
}

interface OutQuestion {
  id: string;
  objectiveId: string;
  concepts: string[];
  /** Extra metadata field — see header note; not part of the frozen schema. */
  dimension: Dimension;
  prompt: string;
  options: OutOption[];
  correctOptionId: string;
  rationale: string;
  remediationAnchor: string;
}

interface LessonPage {
  id: string;
  slug: string;
  title: string;
  topic: { id: string; title: string };
  heroEpigraph: string;
  governingRule: string;
  examClue: string;
  mnemonic?: string;
  scenario: { prompt: string; expectedAnswer: string };
  concepts: { id: string; label: string; importance: string; summary: string }[];
  distractors: { choice: string; whyTempting: string; whyWrong: string }[];
  productionNuance: string[];
  visual: {
    type: string;
    title: string;
    steps: { label: string; state: string; detail: string }[];
  };
  drills: { recall: string; connections: string; application: string; transfer: string };
  reflection: string[];
  references: { label: string; url: string }[];
}

// ---------------------------------------------------------------------------
// Authored data 1/3 — lesson roster and objective fence.
//
// SUBSTITUTION NOTICE: the port brief named lessons PL400-ML-01/03/04/06/07,
// none of which exist in the source directory (it holds ML-09..ML-14 only).
// Per the brief's fallback clause, the closest-topic lessons were substituted.
// Full rationale in docs/content-port-review.md.
// ---------------------------------------------------------------------------

const OBJECTIVES = [
  {
    id: 'custom-connectors-azure-integration',
    title: 'Custom Connectors & Azure Integration',
    summary:
      'Ordering an Entra-Graph custom connector integration (register, permission, consent, connect, call), separating Dataverse event delivery from Azure Function ETL compute, and reasoning about the effective DLP policy that governs which connectors an app or flow may combine.',
  },
  {
    id: 'dataverse-extensibility-platform-limits',
    title: 'Dataverse Extensibility & Platform Limits',
    summary:
      'Designing a Dataverse document architecture within platform storage limits (SharePoint binaries, alternate-key matching, recoverable batch compute) and building delegable canvas-app queries that respect delegation limits with correct date-window boundaries.',
  },
] as const;

const LESSONS = [
  {
    key: 'ml13',
    file: 'PL400-ML-13-entra-graph-connector-order.json',
    objectiveId: 'custom-connectors-azure-integration',
  },
  {
    key: 'ml11',
    file: 'PL400-ML-11-webhook-function-etl-boundary.json',
    objectiveId: 'custom-connectors-azure-integration',
  },
  {
    key: 'ml09',
    file: 'PL400-ML-09-dlp-effective-policy-intersection.json',
    objectiveId: 'custom-connectors-azure-integration',
  },
  {
    key: 'ml12',
    file: 'PL400-ML-12-bulk-document-migration.json',
    objectiveId: 'dataverse-extensibility-platform-limits',
  },
  {
    key: 'ml14',
    file: 'PL400-ML-14-delegable-date-window-gallery.json',
    objectiveId: 'dataverse-extensibility-platform-limits',
  },
] as const;

type LessonKey = (typeof LESSONS)[number]['key'];

// ---------------------------------------------------------------------------
// Authored data 2/3 — the misconception taxonomy (the naming pass).
//
// Distilled across all five lessons' distractors; the same underlying
// mental-model gap appearing in multiple lessons carries ONE shared id so the
// engine's repeated-misconception routing fires across lesson boundaries.
// `contrast` is distilled from the source distractors' whyWrong text;
// `socraticSeeds` from their whyTempting angles. Anchors resolve to lesson
// section ids emitted below.
// ---------------------------------------------------------------------------

const MISCONCEPTIONS = [
  {
    id: 'oauth-chain-unordered',
    name: 'OAuth chain as a checklist',
    contrast:
      'Consent approves an already-requested permission, and each stage of Register, Permission, Consent, Connect, Call depends on the one before it. The chain is a dependency order, not an unordered setup checklist.',
    socraticSeeds: [
      'Which stage produces the thing that consent approves?',
      'What breaks first if you try to grant consent before any permission is requested?',
    ],
    anchor: 'entra-graph-connector-order-rule',
  },
  {
    id: 'permission-mode-ignores-actor',
    name: 'Permission mode chosen by data sensitivity',
    contrast:
      'A signed-in Canvas user normally implies delegated access; application permissions fit unattended daemon and background processes. The caller identity, not how privileged the data feels, selects the permission mode.',
    socraticSeeds: [
      'Who is present at runtime when this call executes?',
      'Does privileged data change who the caller is?',
    ],
    anchor: 'entra-graph-connector-order-production',
  },
  {
    id: 'auth-controls-conflated',
    name: 'Role, permission, and consent collapsed',
    contrast:
      'A directory role is assigned to a user; a Graph permission is requested by an app; consent approves the app request. They are separate controls and must not be merged into one authorization concept.',
    socraticSeeds: [
      'Which of these belongs to the user, and which to the app?',
      'What exactly does consent approve?',
    ],
    anchor: 'entra-graph-connector-order-production',
  },
  {
    id: 'client-side-is-server-side',
    name: 'Client code as a server boundary',
    contrast:
      'Hiding a screen or running browser JavaScript is user experience, not enforcement or compute. Web resources have no server-side execution capability, and a protected operation must validate authorization independently even if a user bypasses client navigation.',
    socraticSeeds: [
      'If a user bypasses the app navigation, what still stops the operation?',
      'Where does this code actually execute?',
    ],
    anchor: 'entra-graph-connector-order-production',
  },
  {
    id: 'component-role-collapse',
    name: 'One component absorbs every job',
    contrast:
      'A webhook is event delivery; the Azure Function is custom compute; the Web API loads data; a custom connector describes how consumers call an API. No component absorbs its neighbor’s job, and the first component in a diagram is not automatically the one doing the processing.',
    socraticSeeds: [
      'Which single job does this component actually own?',
      'Which component in your design is quietly doing two jobs?',
    ],
    anchor: 'webhook-function-etl-boundary-rule',
  },
  {
    id: 'trigger-ignores-origin',
    name: 'Trigger chosen without naming the event origin',
    contrast:
      'Dataverse webhooks originate from Dataverse server events and send them outward. A scheduled pull from legacy systems needs a timer, pipeline, dataflow, or source-side trigger; the delivery mechanism must match where the event starts.',
    socraticSeeds: [
      'Which system creates the event that starts this work?',
      'What fires first on the night this migration runs?',
    ],
    anchor: 'webhook-function-etl-boundary-scenario',
  },
  {
    id: 'flow-scales-to-bulk',
    name: 'Cloud flow as a bulk migration engine',
    contrast:
      'A high-volume initial migration needs controlled batching, checkpoints, retries, reconciliation, and restartability that a purpose-built batch application handles more directly. Cloud flows fit modest, event-driven ongoing workloads.',
    socraticSeeds: [
      'What happens to this run at file 40,000 of 100,000 when a call fails?',
      'How does this workload resume after a failure?',
    ],
    anchor: 'bulk-document-migration-scenario',
  },
  {
    id: 'policy-precedence-instinct',
    name: 'One policy wins by precedence',
    contrast:
      'Power Platform evaluates all applicable data policies together. Neither nearest scope nor most-recent edit creates an override: Blocked takes precedence, and Business/Non-Business groupings intersect across every applicable policy.',
    socraticSeeds: [
      'Which policies participate for this environment, and what says one of them outranks another?',
      'What result do you get if no policy wins and all of them apply?',
    ],
    anchor: 'dlp-effective-policy-intersection-rule',
  },
  {
    id: 'labels-are-ranks',
    name: 'Business as a permission rank',
    contrast:
      'Business and Non-Business are separation groups, not allow-and-deny levels or quality ratings. Compatibility depends on whether two connectors stay grouped together under every applicable policy, and Non-Business is not Blocked.',
    socraticSeeds: [
      'Is Business allowing something, or grouping something?',
      'What would “more permissive” even mean for a data-boundary label?',
    ],
    anchor: 'dlp-effective-policy-intersection-rule',
  },
  {
    id: 'single-policy-view',
    name: 'One policy view looks conclusive',
    contrast:
      'Two unblocked connectors must share the same classification fingerprint across all applicable policies. Sharing a group in one policy, or in a majority of policies, is insufficient: a mismatch in any single policy separates them.',
    socraticSeeds: [
      'Which other policies also classify these two connectors?',
      'What does the full fingerprint look like, position by position?',
    ],
    anchor: 'dlp-effective-policy-intersection-scenario',
  },
  {
    id: 'design-time-only-enforcement',
    name: 'DLP checks only at save time',
    contrast:
      'Data policies are enforced at runtime too: existing apps and flows can become noncompliant after a policy change, a violating flow saves but is marked Suspended and will not execute, and suspension uses background polling so it may not be instantaneous.',
    socraticSeeds: [
      'What happens to a flow that was compliant when it was saved?',
      'If the status has not changed yet, has enforcement actually failed?',
    ],
    anchor: 'dlp-effective-policy-intersection-production',
  },
  {
    id: 'capability-equals-fit',
    name: 'It can store the bytes, so it fits',
    contrast:
      'Raw capability is not fit. Blob Storage needs a custom record-to-blob experience, and Notes consume Dataverse capacity and lack document-management strengths; SharePoint provides the standard document experience in model-driven record context.',
    socraticSeeds: [
      'What experience must users get when they open the record?',
      'What does this choice cost in capacity or custom UI to reach that experience?',
    ],
    anchor: 'bulk-document-migration-rule',
  },
  {
    id: 'identity-by-name',
    name: 'Record matching on mutable names',
    contrast:
      'An alternate key on a stable source identifier resolves the right record when the Dataverse GUID is unknown. Display names are mutable and fragile, and dropping the match entirely orphans documents from their business records.',
    socraticSeeds: [
      'What happens when two accounts share a name, or one is renamed?',
      'Which identifier survives every rename?',
    ],
    anchor: 'bulk-document-migration-production',
  },
  {
    id: 'return-shape-confusion',
    name: 'Function chosen by keyword, not return type',
    contrast:
      'Filter returns a table of all matching rows; LookUp returns one record; DateAdd returns a date/time; DateDiff returns a number of units; Set returns no value. The return type decides where each function can be used.',
    socraticSeeds: [
      'What type of value does this property need?',
      'What exactly does that function hand back?',
    ],
    anchor: 'delegable-date-window-gallery-rule',
  },
  {
    id: 'behavior-in-data-property',
    name: 'Set inside a data formula',
    contrast:
      'Set is a behavior-only function with no return value, and its variable does not automatically recalculate. Gallery.Items is a data formula that must evaluate to a table: run Set from a behavior property and reference the variable.',
    socraticSeeds: [
      'Does this property run actions, or evaluate to a value?',
      'What would Gallery.Items display if its formula returns nothing?',
    ],
    anchor: 'delegable-date-window-gallery-scenario',
  },
  {
    id: 'delegation-assumed',
    name: 'Delegation as a generic function property',
    contrast:
      'Delegation is connector-, operator-, and column-type-specific. A delegation warning means the app may evaluate the predicate over a limited local subset and silently omit qualifying rows; it must be verified against the actual data source.',
    socraticSeeds: [
      'Which connector, operator, and column type is this predicate actually hitting?',
      'How would you notice if qualifying rows were missing?',
    ],
    anchor: 'delegable-date-window-gallery-production',
  },
  {
    id: 'one-sided-window',
    name: 'An upper bound treated as a window',
    contrast:
      'An upper bound alone admits every older row. A true next-seven-days window needs both boundaries, and for date-time data an exclusive next-day upper bound is what covers all of day seven.',
    socraticSeeds: [
      'What is the oldest order this filter admits?',
      'Which orders on day seven itself does your boundary include?',
    ],
    anchor: 'delegable-date-window-gallery-production',
  },
] as const;

type MisconceptionId = (typeof MISCONCEPTIONS)[number]['id'];

// ---------------------------------------------------------------------------
// Authored data 3/3 — per-question concept tags and per-distractor
// misconception assignments, keyed by lesson key + source question id.
// `wrong` lists misconception ids for SOURCE option indexes in ascending
// order, excluding the answer index (all source specs key the answer at
// index 0, which the converter asserts).
// ---------------------------------------------------------------------------

const QUESTION_MAP: Record<
  LessonKey,
  Record<string, { concepts: string[]; wrong: MisconceptionId[] }>
> = {
  ml13: {
    q1: {
      concepts: ['app-registration', 'graph-permission', 'consent'],
      wrong: ['oauth-chain-unordered', 'oauth-chain-unordered', 'oauth-chain-unordered'],
    },
    q2: {
      concepts: ['graph-permission', 'consent'],
      wrong: ['auth-controls-conflated', 'auth-controls-conflated', 'auth-controls-conflated'],
    },
    q3: {
      concepts: ['graph-permission', 'canvas-app'],
      wrong: ['permission-mode-ignores-actor', 'oauth-chain-unordered', 'auth-controls-conflated'],
    },
    q4: {
      concepts: ['connector'],
      wrong: ['auth-controls-conflated', 'component-role-collapse', 'component-role-collapse'],
    },
    q5: {
      concepts: ['consent', 'graph-permission', 'server-authorization'],
      wrong: ['auth-controls-conflated', 'auth-controls-conflated', 'auth-controls-conflated'],
    },
    q6: {
      concepts: ['server-authorization', 'canvas-app'],
      wrong: ['client-side-is-server-side', 'auth-controls-conflated', 'client-side-is-server-side'],
    },
    q7: {
      concepts: ['graph-permission', 'consent'],
      wrong: ['permission-mode-ignores-actor', 'oauth-chain-unordered', 'client-side-is-server-side'],
    },
  },
  ml11: {
    q1: {
      concepts: ['custom-compute', 'delivery-mechanism'],
      wrong: ['component-role-collapse', 'component-role-collapse', 'client-side-is-server-side'],
    },
    q2: {
      concepts: ['event-origin', 'delivery-mechanism'],
      wrong: ['trigger-ignores-origin', 'client-side-is-server-side', 'component-role-collapse'],
    },
    q3: {
      concepts: ['web-resource', 'dataverse-api'],
      wrong: ['client-side-is-server-side', 'component-role-collapse', 'client-side-is-server-side'],
    },
    q4: {
      concepts: ['delivery-mechanism', 'custom-compute'],
      wrong: ['client-side-is-server-side', 'component-role-collapse', 'component-role-collapse'],
    },
    q5: {
      concepts: ['custom-connector'],
      wrong: ['component-role-collapse', 'component-role-collapse', 'component-role-collapse'],
    },
    q6: {
      concepts: ['service-bus', 'delivery-mechanism'],
      wrong: ['client-side-is-server-side', 'component-role-collapse', 'component-role-collapse'],
    },
    q7: {
      concepts: ['event-origin', 'custom-compute'],
      wrong: ['trigger-ignores-origin', 'client-side-is-server-side', 'component-role-collapse'],
    },
  },
  ml09: {
    q1: {
      concepts: ['blocked-precedence'],
      wrong: ['labels-are-ranks', 'labels-are-ranks', 'policy-precedence-instinct'],
    },
    q2: {
      concepts: ['classification-fingerprint'],
      wrong: ['labels-are-ranks', 'labels-are-ranks', 'policy-precedence-instinct'],
    },
    q3: {
      concepts: ['classification-fingerprint', 'coexistence-test'],
      wrong: ['labels-are-ranks', 'policy-precedence-instinct', 'single-policy-view'],
    },
    q4: {
      concepts: ['coexistence-test', 'policy-fragmentation'],
      wrong: ['single-policy-view', 'labels-are-ranks', 'policy-precedence-instinct'],
    },
    q5: {
      concepts: ['enforcement-surface'],
      wrong: ['design-time-only-enforcement', 'policy-precedence-instinct', 'design-time-only-enforcement'],
    },
    q6: {
      concepts: ['enforcement-surface'],
      wrong: ['design-time-only-enforcement', 'policy-precedence-instinct', 'design-time-only-enforcement'],
    },
    q7: {
      concepts: ['applicable-policy-set', 'classification-fingerprint'],
      wrong: ['single-policy-view', 'labels-are-ranks', 'policy-precedence-instinct'],
    },
  },
  ml12: {
    q1: {
      concepts: ['sharepoint-content', 'dataverse-attachments'],
      wrong: ['capability-equals-fit', 'component-role-collapse', 'component-role-collapse'],
    },
    q2: {
      concepts: ['migration-compute', 'customer-record', 'sharepoint-content'],
      wrong: ['component-role-collapse', 'capability-equals-fit', 'flow-scales-to-bulk'],
    },
    q3: {
      concepts: ['customer-record'],
      wrong: ['identity-by-name', 'identity-by-name', 'client-side-is-server-side'],
    },
    q4: {
      concepts: ['migration-compute', 'ongoing-automation'],
      wrong: ['flow-scales-to-bulk', 'component-role-collapse', 'auth-controls-conflated'],
    },
    q5: {
      concepts: ['blob-storage', 'sharepoint-content'],
      wrong: ['capability-equals-fit', 'capability-equals-fit', 'capability-equals-fit'],
    },
    q6: {
      concepts: ['ongoing-automation', 'sharepoint-content', 'customer-record'],
      wrong: ['capability-equals-fit', 'component-role-collapse', 'identity-by-name'],
    },
  },
  ml14: {
    q1: {
      concepts: ['gallery-table', 'lookup-record'],
      wrong: ['return-shape-confusion', 'return-shape-confusion', 'return-shape-confusion'],
    },
    q2: {
      concepts: ['server-predicate', 'date-boundary'],
      wrong: ['delegation-assumed', 'return-shape-confusion', 'return-shape-confusion'],
    },
    q3: {
      concepts: ['date-boundary'],
      wrong: ['return-shape-confusion', 'return-shape-confusion', 'return-shape-confusion'],
    },
    q4: {
      concepts: ['set-global'],
      wrong: ['behavior-in-data-property', 'behavior-in-data-property', 'return-shape-confusion'],
    },
    q5: {
      concepts: ['date-boundary', 'set-global', 'gallery-table'],
      wrong: ['return-shape-confusion', 'behavior-in-data-property', 'return-shape-confusion'],
    },
    q6: {
      concepts: ['server-predicate'],
      wrong: ['delegation-assumed', 'return-shape-confusion', 'behavior-in-data-property'],
    },
    q7: {
      concepts: ['date-window', 'server-predicate'],
      wrong: ['one-sided-window', 'return-shape-confusion', 'return-shape-confusion'],
    },
  },
};

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

const OPTION_LETTERS = ['a', 'b', 'c', 'd'] as const;

/** Section-body strings are rendered as plain text in the UI; drop markdown backticks. */
function plain(text: string): string {
  return text.replaceAll('`', '');
}

function anchors(slug: string) {
  return {
    rule: `${slug}-rule`,
    examClue: `${slug}-exam-clue`,
    scenario: `${slug}-scenario`,
    production: `${slug}-production`,
  };
}

/** Remediation anchor per rubric dimension: recall/connections → rule, application → scenario, transfer → production. */
function remediationAnchor(slug: string, dimension: Dimension): string {
  const a = anchors(slug);
  if (dimension === 'application') return a.scenario;
  if (dimension === 'transfer') return a.production;
  return a.rule;
}

function convertQuestion(
  lessonKey: LessonKey,
  slug: string,
  objectiveId: string,
  question: SpecQuestion,
  questionIndex: number,
): OutQuestion {
  if (question.answerIndex !== 0) {
    throw new Error(
      `${lessonKey}/${question.id}: expected answerIndex 0, got ${String(question.answerIndex)}`,
    );
  }
  if (question.options.length !== 4) {
    throw new Error(
      `${lessonKey}/${question.id}: expected 4 options, got ${String(question.options.length)}`,
    );
  }
  const map = QUESTION_MAP[lessonKey][question.id];
  if (!map) {
    throw new Error(`${lessonKey}/${question.id}: no entry in QUESTION_MAP`);
  }
  if (map.wrong.length !== 3) {
    throw new Error(`${lessonKey}/${question.id}: QUESTION_MAP.wrong must list 3 ids`);
  }

  const dimension = question.dimension.toLowerCase() as Dimension;
  const id = `${lessonKey}-${question.id}`;

  // Deterministic display rotation so the keyed answer (always source index 0)
  // does not always render as option A: display[i] = source[(i + k) % 4].
  const k = questionIndex % 4;
  const options: OutOption[] = [];
  let correctOptionId = '';
  for (let i = 0; i < 4; i += 1) {
    const sourceIndex = (i + k) % 4;
    const optionId = `${id}-${OPTION_LETTERS[i]}`;
    if (sourceIndex === 0) {
      options.push({ id: optionId, text: plain(question.options[0]) });
      correctOptionId = optionId;
    } else {
      options.push({
        id: optionId,
        text: plain(question.options[sourceIndex]),
        misconceptionId: map.wrong[sourceIndex - 1],
      });
    }
  }

  return {
    id,
    objectiveId,
    concepts: map.concepts,
    dimension,
    prompt: plain(question.prompt),
    options,
    correctOptionId,
    rationale: plain(question.explanation),
    remediationAnchor: remediationAnchor(slug, dimension),
  };
}

function lessonSectionsFor(lesson: SpecLesson) {
  const a = anchors(lesson.slug);
  const clueBody = [plain(lesson.examClue)];
  if (lesson.mnemonic) {
    clueBody.push(`Mnemonic: ${plain(lesson.mnemonic)}`);
  }
  return [
    {
      id: a.rule,
      title: lesson.title,
      body: [plain(lesson.heroEpigraph), plain(lesson.governingRule)],
    },
    {
      id: a.examClue,
      title: `${lesson.title} — exam clue`,
      body: clueBody,
    },
    {
      id: a.scenario,
      title: `${lesson.title} — worked scenario`,
      body: [plain(lesson.scenario.prompt), `Expected answer: ${plain(lesson.scenario.expectedAnswer)}`],
    },
    {
      id: a.production,
      title: `${lesson.title} — production nuance`,
      body: lesson.productionNuance.map(plain),
    },
  ];
}

function lessonMarkdown(lesson: SpecLesson): string {
  const a = anchors(lesson.slug);
  const lines: string[] = [];
  lines.push(`# ${lesson.title}`);
  lines.push('');
  lines.push(`> ${lesson.heroEpigraph}`);
  lines.push('');
  lines.push(
    `_Ported from the authored PL-400 micro-lesson spec ${lesson.id} (CC BY 4.0, see content/LICENSE)._`,
  );
  lines.push('');
  lines.push(`## Governing rule {#${a.rule}}`);
  lines.push('');
  lines.push(lesson.governingRule);
  lines.push('');
  lines.push(`## Exam clue {#${a.examClue}}`);
  lines.push('');
  lines.push(`**${lesson.examClue}**`);
  if (lesson.mnemonic) {
    lines.push('');
    lines.push(`Mnemonic: ${lesson.mnemonic}`);
  }
  lines.push('');
  lines.push(`## Worked scenario {#${a.scenario}}`);
  lines.push('');
  lines.push(lesson.scenario.prompt);
  lines.push('');
  lines.push(`**Expected answer.** ${lesson.scenario.expectedAnswer}`);
  lines.push('');
  lines.push(`## Production nuance {#${a.production}}`);
  lines.push('');
  for (const nuance of lesson.productionNuance) {
    lines.push(`- ${nuance}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Rich page payload for the /pl-400/[slug] template. Strings are copied verbatim (no `plain()`). */
function lessonPageFor(lesson: SpecLesson): LessonPage {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    topic: { id: lesson.topic.id, title: lesson.topic.title },
    heroEpigraph: lesson.heroEpigraph,
    governingRule: lesson.governingRule,
    examClue: lesson.examClue,
    ...(lesson.mnemonic !== undefined ? { mnemonic: lesson.mnemonic } : {}),
    scenario: {
      prompt: lesson.scenario.prompt,
      expectedAnswer: lesson.scenario.expectedAnswer,
    },
    concepts: lesson.concepts.map((concept) => ({
      id: concept.id,
      label: concept.label,
      importance: concept.importance,
      summary: concept.summary,
    })),
    distractors: lesson.distractors.map((distractor) => ({
      choice: distractor.choice,
      whyTempting: distractor.whyTempting,
      whyWrong: distractor.whyWrong,
    })),
    productionNuance: lesson.productionNuance,
    visual: {
      type: lesson.visual.type,
      title: lesson.visual.title,
      steps: lesson.visual.steps.map((step) => ({
        label: step.label,
        state: step.state,
        detail: step.detail,
      })),
    },
    drills: {
      recall: lesson.drills.Recall,
      connections: lesson.drills.Connections,
      application: lesson.drills.Application,
      transfer: lesson.drills.Transfer,
    },
    reflection: lesson.reflection,
    references: (lesson.references ?? []).map((reference) => ({
      label: reference.label,
      url: reference.url,
    })),
  };
}

async function main(): Promise<void> {
  const sourceDir = process.argv[2] ?? process.env.LESSON_SPEC_DIR;
  if (!sourceDir) {
    console.error(
      'Usage: bun scripts/port-lessons.ts <lesson-spec-dir>   (or set LESSON_SPEC_DIR)',
    );
    process.exit(1);
  }

  const contentRoot = join(import.meta.dir, '..', 'content', 'pl-400');
  const lessonsDir = join(contentRoot, 'lessons');
  await mkdir(lessonsDir, { recursive: true });

  const allSections: { id: string; title: string; body: string[] }[] = [];
  const allPages: LessonPage[] = [];
  const allQuestions: OutQuestion[] = [];
  const questionIdsByObjective = new Map<string, string[]>();
  for (const objective of OBJECTIVES) {
    questionIdsByObjective.set(objective.id, []);
  }

  for (const entry of LESSONS) {
    const raw = JSON.parse(await readFile(join(sourceDir, entry.file), 'utf8')) as {
      lesson: SpecLesson;
    };
    const lesson = raw.lesson;

    allPages.push(lessonPageFor(lesson));
    allSections.push(...lessonSectionsFor(lesson));
    await writeFile(join(lessonsDir, `${lesson.slug}.md`), lessonMarkdown(lesson), 'utf8');

    lesson.questions.forEach((question, index) => {
      const converted = convertQuestion(entry.key, lesson.slug, entry.objectiveId, question, index);
      allQuestions.push(converted);
      questionIdsByObjective.get(entry.objectiveId)?.push(converted.id);
    });
  }

  const manifest = {
    courseId: 'pl-400',
    title: 'PL-400 Mastery Gate',
    objectives: OBJECTIVES.map((objective) => ({
      id: objective.id,
      title: objective.title,
      summary: objective.summary,
      questionIds: questionIdsByObjective.get(objective.id) ?? [],
    })),
    questions: allQuestions,
    misconceptions: MISCONCEPTIONS.map((m) => ({
      id: m.id,
      name: m.name,
      contrast: m.contrast,
      socraticSeeds: [...m.socraticSeeds],
      anchor: m.anchor,
    })),
  };

  await writeFile(join(contentRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(
    join(contentRoot, 'lesson-sections.json'),
    `${JSON.stringify(allSections, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(contentRoot, 'lesson-pages.json'),
    `${JSON.stringify(allPages, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Ported ${String(LESSONS.length)} lessons: ${String(manifest.objectives.length)} objectives, ${String(allQuestions.length)} questions, ${String(manifest.misconceptions.length)} misconceptions, ${String(allSections.length)} lesson sections, ${String(allPages.length)} lesson pages`,
  );
}

await main();
