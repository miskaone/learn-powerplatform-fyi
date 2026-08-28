import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentManifest } from '../packages/mastery-gate/src/schema';
import {
  validateFlipConditionScenario,
  type FlipConditionScenario,
} from '../packages/mastery-gate/src/rules/flipCondition';
import { DECISION_TREES } from '../packages/mastery-gate/src/rules/rules';

const contentRoot = join(import.meta.dir, '..', 'content', 'pl-400');
const manifestPath = join(contentRoot, 'manifest.json');
const lessonsDir = join(contentRoot, 'lessons');
const flipDir = join(contentRoot, 'flip-conditions');
const ANCHOR_RE = /\{#([A-Za-z0-9_-]+)\}/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

async function readJson(path: string): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { ok: false, error: `Failed to read '${path}'` };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: `'${path}' is not valid JSON` };
  }
}

async function collectLessonAnchors(): Promise<{
  anchors: Set<string>;
  errors: string[];
}> {
  const errors: string[] = [];
  const anchors = new Set<string>();
  let names: string[] = [];
  try {
    names = (await readdir(lessonsDir)).filter((name) => name.endsWith('.md'));
  } catch {
    errors.push('Unable to read content/pl-400/lessons');
    return { anchors, errors };
  }

  for (const name of names.sort()) {
    const path = join(lessonsDir, name);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch {
      errors.push(`Unable to read lesson '${name}'`);
      continue;
    }
    for (const match of text.matchAll(ANCHOR_RE)) {
      const id = match[1];
      if (id) {
        anchors.add(id);
      }
    }
  }

  return { anchors, errors };
}

function validateManifestShape(
  raw: unknown,
  errors: string[],
): ContentManifest | null {
  if (!isRecord(raw)) {
    errors.push('manifest.json root is not an object');
    return null;
  }

  const courseId = asString(raw.courseId);
  const title = asString(raw.title);
  if (!courseId || courseId.trim() === '') {
    errors.push('courseId is empty');
  }
  if (!title || title.trim() === '') {
    errors.push('title is empty');
  }

  const objectives = asArray(raw.objectives);
  const questions = asArray(raw.questions);
  const misconceptions = asArray(raw.misconceptions);
  if (!objectives) {
    errors.push('objectives is not an array');
  }
  if (!questions) {
    errors.push('questions is not an array');
  }
  if (!misconceptions) {
    errors.push('misconceptions is not an array');
  }

  if (!objectives || !questions || !misconceptions) {
    return null;
  }

  return raw as unknown as ContentManifest;
}

function claimId(
  seen: Map<string, string>,
  id: string,
  kind: string,
  errors: string[],
): void {
  const existing = seen.get(id);
  if (existing) {
    errors.push(`${kind} id '${id}' collides with ${existing} id '${id}'`);
    return;
  }
  seen.set(id, kind);
}

function validateUniqueness(manifest: ContentManifest, errors: string[]): void {
  const seen = new Map<string, string>();

  for (const objective of manifest.objectives) {
    if (!isRecord(objective) || typeof objective.id !== 'string') {
      errors.push('An objective is missing id');
      continue;
    }
    claimId(seen, objective.id, 'objective', errors);
  }

  for (const question of manifest.questions) {
    if (!isRecord(question) || typeof question.id !== 'string') {
      errors.push('A question is missing id');
      continue;
    }
    claimId(seen, question.id, 'question', errors);
    const options = asArray(question.options) ?? [];
    const optionIds = new Set<string>();
    for (const option of options) {
      if (!isRecord(option) || typeof option.id !== 'string') {
        errors.push(`Question '${question.id}' has an option missing id`);
        continue;
      }
      if (optionIds.has(option.id)) {
        errors.push(`Question '${question.id}' has duplicate option ids`);
      }
      optionIds.add(option.id);
    }
  }

  for (const misconception of manifest.misconceptions) {
    if (!isRecord(misconception) || typeof misconception.id !== 'string') {
      errors.push('A misconception is missing id');
      continue;
    }
    claimId(seen, misconception.id, 'misconception', errors);
  }
}

function validateObjectivesAndQuestions(
  manifest: ContentManifest,
  errors: string[],
): void {
  const questionsById = new Map<string, ContentManifest['questions'][number]>();
  for (const question of manifest.questions) {
    if (typeof question.id === 'string') {
      questionsById.set(question.id, question);
    }
  }

  const objectivesById = new Map<
    string,
    ContentManifest['objectives'][number]
  >();
  for (const objective of manifest.objectives) {
    if (typeof objective.id !== 'string') {
      continue;
    }
    objectivesById.set(objective.id, objective);

    if (typeof objective.title !== 'string' || objective.title.trim() === '') {
      errors.push(`Objective '${objective.id}' title is empty`);
    }
    if (
      typeof objective.summary !== 'string' ||
      objective.summary.trim() === ''
    ) {
      errors.push(`Objective '${objective.id}' summary is empty`);
    }

    const questionIds = asArray(objective.questionIds) ?? [];
    if (questionIds.length < 1) {
      errors.push(`Objective '${objective.id}' has no questions`);
    }
    for (const questionId of questionIds) {
      if (typeof questionId !== 'string') {
        errors.push(`Objective '${objective.id}' has a non-string questionId`);
        continue;
      }
      if (!questionsById.has(questionId)) {
        errors.push(
          `Objective '${objective.id}' lists unknown question '${questionId}'`,
        );
      }
    }
  }

  for (const question of manifest.questions) {
    if (typeof question.id !== 'string') {
      continue;
    }
    if (typeof question.objectiveId !== 'string' || question.objectiveId === '') {
      errors.push(`Question '${question.id}' is missing objectiveId`);
      continue;
    }
    const objective = objectivesById.get(question.objectiveId);
    if (!objective) {
      errors.push(`Question '${question.id}' has an unknown objectiveId`);
      continue;
    }
    const listed = asArray(objective.questionIds) ?? [];
    if (!listed.includes(question.id)) {
      errors.push(
        `Question '${question.id}' is not listed on its objective`,
      );
    }
  }
}

function validateQuestions(
  manifest: ContentManifest,
  misconceptionIds: Set<string>,
  errors: string[],
): void {
  for (const question of manifest.questions) {
    if (typeof question.id !== 'string') {
      continue;
    }
    const id = question.id;

    if (typeof question.objectiveId !== 'string' || question.objectiveId === '') {
      errors.push(`Question '${id}' is missing objectiveId`);
    }

    const concepts = asArray(question.concepts);
    if (!concepts || concepts.length < 1) {
      errors.push(`Question '${id}' concepts is empty`);
    }

    if (typeof question.prompt !== 'string' || question.prompt.trim() === '') {
      errors.push(`Question '${id}' prompt is empty`);
    }

    const options = asArray(question.options) ?? [];
    if (options.length < 2) {
      errors.push(`Question '${id}' has fewer than 2 options`);
    }

    const matching: Record<string, unknown>[] = [];
    let distractorMissingMc = false;
    let distractorUnknownMc = false;
    let correctHasMc = false;

    for (const option of options) {
      if (!isRecord(option)) {
        errors.push(`Question '${id}' has a non-object option`);
        continue;
      }
      if (option.id === question.correctOptionId) {
        matching.push(option);
        if ('misconceptionId' in option && option.misconceptionId !== undefined) {
          correctHasMc = true;
        }
      } else if (typeof option.misconceptionId !== 'string') {
        distractorMissingMc = true;
      } else if (!misconceptionIds.has(option.misconceptionId)) {
        distractorUnknownMc = true;
      }
    }

    if (matching.length !== 1) {
      errors.push(
        `Question '${id}' does not have exactly one correct option`,
      );
    }
    if (correctHasMc) {
      errors.push(`Question '${id}' correct option must not carry a misconceptionId`);
    }
    if (distractorMissingMc) {
      errors.push(`Question '${id}' has a distractor without a misconceptionId`);
    }
    if (distractorUnknownMc) {
      errors.push(
        `Question '${id}' has a distractor whose misconceptionId is unknown`,
      );
    }

    if (
      typeof question.rationale !== 'string' ||
      question.rationale.trim() === ''
    ) {
      errors.push(`Question '${id}' rationale is empty`);
    }

    if (
      typeof question.remediationAnchor !== 'string' ||
      question.remediationAnchor.trim() === ''
    ) {
      errors.push(`Question '${id}' remediationAnchor is empty`);
    }
  }
}

function validateAnchors(
  manifest: ContentManifest,
  anchors: Set<string>,
  errors: string[],
): void {
  for (const question of manifest.questions) {
    if (typeof question.id !== 'string') {
      continue;
    }
    const anchor = question.remediationAnchor;
    if (typeof anchor === 'string' && anchor.trim() !== '') {
      if (!anchors.has(anchor)) {
        errors.push(
          `Question '${question.id}' remediationAnchor does not resolve`,
        );
      }
    }
  }

  for (const misconception of manifest.misconceptions) {
    if (typeof misconception.id !== 'string') {
      continue;
    }
    const anchor = misconception.anchor;
    if (typeof anchor !== 'string' || anchor.trim() === '') {
      errors.push(`Misconception '${misconception.id}' anchor is empty`);
      continue;
    }
    if (!anchors.has(anchor)) {
      errors.push(
        `Misconception '${misconception.id}' anchor does not resolve`,
      );
    }
  }
}

function validateMisconceptions(
  manifest: ContentManifest,
  errors: string[],
): void {
  for (const misconception of manifest.misconceptions) {
    if (typeof misconception.id !== 'string') {
      continue;
    }
    const id = misconception.id;
    if (typeof misconception.name !== 'string' || misconception.name.trim() === '') {
      errors.push(`Misconception '${id}' name is empty`);
    }
    if (
      typeof misconception.contrast !== 'string' ||
      misconception.contrast.trim() === ''
    ) {
      errors.push(`Misconception '${id}' contrast is empty`);
    }
    const seeds = asArray(misconception.socraticSeeds);
    if (!seeds || seeds.length < 1) {
      errors.push(`Misconception '${id}' socraticSeeds is empty`);
    }
  }
}

async function validateFlipScenarios(
  anchors: Set<string>,
  errors: string[],
): Promise<number> {
  let names: string[] = [];
  try {
    names = (await readdir(flipDir)).filter((name) => name.endsWith('.json'));
  } catch {
    errors.push('Unable to read content/pl-400/flip-conditions');
    return 0;
  }

  let count = 0;
  for (const name of names.sort()) {
    const path = join(flipDir, name);
    const parsed = await readJson(path);
    if (!parsed.ok) {
      errors.push(`Flip scenario file '${name}' is not valid JSON`);
      continue;
    }
    if (!isRecord(parsed.value)) {
      errors.push(`Flip scenario file '${name}' root is not an object`);
      continue;
    }

    const id = asString(parsed.value.id) ?? name;
    count += 1;

    const treeKind = parsed.value.treeKind;
    if (typeof treeKind !== 'string' || !(treeKind in DECISION_TREES)) {
      errors.push(`Flip scenario '${id}' has an unknown treeKind`);
    }

    const scenario = parsed.value as unknown as FlipConditionScenario;
    for (const message of validateFlipConditionScenario(scenario)) {
      errors.push(`Flip scenario '${id}': ${message}`);
    }

    const rows = asArray(parsed.value.rows) ?? [];
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== 'string') {
        errors.push(`Flip scenario '${id}' has a row missing id`);
        continue;
      }
      const citation = asString(row.citation);
      if (!citation || citation.trim() === '') {
        errors.push(`Flip scenario '${id}' row '${row.id}' citation is empty`);
        continue;
      }
      if (!anchors.has(citation)) {
        errors.push(
          `Flip scenario '${id}' row '${row.id}' citation does not resolve`,
        );
      }
    }
  }

  return count;
}


/**
 * The manifest MUST ship an explicit exam form: without one the engine
 * falls back to every manifest question in DEFAULT_EXAM_DURATION_SECONDS
 * (34 questions in 600s — cross-review MAJOR 9, 2026-08-27). The form's
 * ids must exist, must not repeat, and the duration must sit inside the
 * engine's clamp range so creation and reload agree.
 */
function validateExamConfig(manifest: ContentManifest, errors: string[]): void {
  const exam = (manifest as { exam?: unknown }).exam;
  if (exam === undefined) {
    errors.push('manifest.exam is missing — an explicit exam form is required');
    return;
  }
  if (!isRecord(exam)) {
    errors.push('manifest.exam is not an object');
    return;
  }
  const ids = asArray(exam.questionIds);
  if (!ids || ids.length < 1) {
    errors.push('manifest.exam.questionIds is missing or empty');
    return;
  }
  const known = new Set(manifest.questions.map((question) => question.id));
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string') {
      errors.push('manifest.exam.questionIds contains a non-string entry');
      continue;
    }
    if (!known.has(id)) {
      errors.push(`manifest.exam question '${id}' is not in the bank`);
    }
    if (seen.has(id)) {
      errors.push(`manifest.exam question '${id}' is listed twice`);
    }
    seen.add(id);
  }
  const duration = exam.durationSeconds;
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    errors.push('manifest.exam.durationSeconds is not a number');
  } else if (duration < 60 || duration > 7200) {
    errors.push('manifest.exam.durationSeconds must be within [60, 7200]');
  } else if (duration / ids.length < 30) {
    errors.push(
      'manifest.exam allots under 30 seconds per question — shrink the form or extend the duration',
    );
  }
}

const errors: string[] = [];

const manifestParsed = await readJson(manifestPath);
if (!manifestParsed.ok) {
  errors.push('manifest.json is missing or not valid JSON');
}

const { anchors, errors: lessonErrors } = await collectLessonAnchors();
errors.push(...lessonErrors);

let objectiveCount = 0;
let questionCount = 0;
let misconceptionCount = 0;
let flipCount = 0;

if (manifestParsed.ok) {
  const manifest = validateManifestShape(manifestParsed.value, errors);
  if (manifest) {
    objectiveCount = manifest.objectives.length;
    questionCount = manifest.questions.length;
    misconceptionCount = manifest.misconceptions.length;

    const misconceptionIds = new Set<string>();
    for (const misconception of manifest.misconceptions) {
      if (typeof misconception.id === 'string') {
        misconceptionIds.add(misconception.id);
      }
    }

    validateUniqueness(manifest, errors);
    validateObjectivesAndQuestions(manifest, errors);
    validateQuestions(manifest, misconceptionIds, errors);
    validateAnchors(manifest, anchors, errors);
    validateMisconceptions(manifest, errors);
    validateExamConfig(manifest, errors);
  }
}

flipCount = await validateFlipScenarios(anchors, errors);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log(
  `OK: ${String(objectiveCount)} objectives, ${String(questionCount)} questions, ${String(misconceptionCount)} misconceptions, ${String(flipCount)} flip scenarios, ${String(anchors.size)} lesson anchors`,
);
process.exit(0);
