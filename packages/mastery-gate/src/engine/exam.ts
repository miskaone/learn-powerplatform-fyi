import type {
  ContentManifest,
  ExamState,
  ExamVerdict,
  Ledger,
  Question,
  RubricScores,
} from '../schema';
import { cloneLedger } from './ledger';

export interface ExamAnswerResult {
  questionId: string;
  optionId: string;
  /**
   * Always null mid-exam: correctness is withheld until submit, so
   * submit_answer cannot be used as a per-question answer oracle
   * (cross-review BLOCKER 2, 2026-08-27). Grading happens at submit.
   */
  correct: null;
  misconceptionId: string | null;
  attemptNumber: number;
}

export const DEFAULT_EXAM_DURATION_SECONDS = 600;
export const MIN_EXAM_DURATION_SECONDS = 60;
export const MAX_EXAM_DURATION_SECONDS = 7200;

export interface ExamStatus {
  active: boolean;
  remainingSeconds: number;
  questionsAnswered: number;
  questionsTotal: number;
  submitted: boolean;
}

export interface ExamDebrief {
  scores: RubricScores;
  verdicts: ExamVerdict[];
  missedConceptIds: string[];
  misconceptionIdsFired: string[];
}

export interface ResolvedExamConfig {
  questionIds: string[];
  durationSeconds: number;
}

function findQuestion(
  manifest: ContentManifest,
  questionId: string,
): Question | null {
  for (const question of manifest.questions) {
    if (question.id === questionId) {
      return question;
    }
  }
  return null;
}

function manifestQuestionIds(manifest: ContentManifest): string[] {
  return manifest.questions.map((question) => question.id);
}

function clampDurationSeconds(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_EXAM_DURATION_SECONDS;
  }
  if (raw < MIN_EXAM_DURATION_SECONDS) {
    return MIN_EXAM_DURATION_SECONDS;
  }
  if (raw > MAX_EXAM_DURATION_SECONDS) {
    return MAX_EXAM_DURATION_SECONDS;
  }
  return raw;
}

export function resolveExamConfig(manifest: ContentManifest): ResolvedExamConfig {
  const known = new Set(manifestQuestionIds(manifest));
  const configured = manifest.exam?.questionIds;
  let questionIds: string[] = [];
  if (configured !== undefined) {
    const seen = new Set<string>();
    for (const id of configured) {
      if (!known.has(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      questionIds.push(id);
    }
  }
  if (questionIds.length === 0) {
    questionIds = manifestQuestionIds(manifest);
  }
  return {
    questionIds,
    durationSeconds: clampDurationSeconds(manifest.exam?.durationSeconds),
  };
}

/**
 * Elapsed time uses the high-water mark of every observed clock reading
 * (`lastSeenAt`), so setting the OS clock back never rewinds the exam.
 */
export function examElapsedSeconds(exam: ExamState, now: number): number {
  const effectiveNow = Math.max(now, exam.lastSeenAt);
  return Math.floor((effectiveNow - exam.startedAt) / 1000);
}

/**
 * Records a clock observation on the active exam's high-water mark.
 * Returns the same ledger when there is nothing to record.
 */
export function applyObserveExamClock(ledger: Ledger, now: number): Ledger {
  const exam = ledger.exam;
  if (exam === null || exam.submitted || now <= exam.lastSeenAt) {
    return ledger;
  }
  const next = cloneLedger(ledger);
  if (next.exam === null) {
    return ledger;
  }
  next.exam.lastSeenAt = now;
  return next;
}

export function isExamExpired(exam: ExamState, now: number): boolean {
  return examElapsedSeconds(exam, now) >= exam.durationSeconds;
}

export function isExamActive(exam: ExamState | null): boolean {
  return exam !== null && !exam.submitted;
}

function remainingSeconds(exam: ExamState, now: number): number {
  if (exam.submitted) {
    return 0;
  }
  return Math.max(0, exam.durationSeconds - examElapsedSeconds(exam, now));
}

function questionsAnswered(exam: ExamState): number {
  const allowed = new Set(exam.questionIds);
  let count = 0;
  for (const questionId of Object.keys(exam.answers)) {
    if (allowed.has(questionId)) {
      count += 1;
    }
  }
  return count;
}

export function toExamStatus(exam: ExamState | null, now: number): ExamStatus {
  if (exam === null) {
    return {
      active: false,
      remainingSeconds: 0,
      questionsAnswered: 0,
      questionsTotal: 0,
      submitted: false,
    };
  }
  return {
    active: !exam.submitted,
    remainingSeconds: remainingSeconds(exam, now),
    questionsAnswered: questionsAnswered(exam),
    questionsTotal: exam.questionIds.length,
    submitted: exam.submitted,
  };
}

export function currentExamQuestionId(exam: ExamState): string | null {
  for (const questionId of exam.questionIds) {
    if (!Object.prototype.hasOwnProperty.call(exam.answers, questionId)) {
      return questionId;
    }
  }
  // Every question has an answer: there is no current question, and no
  // answer may be overwritten — a wrong answer must not be laundered into a
  // correct grade by re-answering (cross-review BLOCKER 3, 2026-08-27).
  return null;
}

export function findCurrentExamQuestion(
  manifest: ContentManifest,
  exam: ExamState,
): Question | null {
  const questionId = currentExamQuestionId(exam);
  if (questionId === null) {
    return null;
  }
  return findQuestion(manifest, questionId);
}

function cloneVerdict(verdict: ExamVerdict): ExamVerdict {
  return {
    questionId: verdict.questionId,
    chosenOptionId: verdict.chosenOptionId,
    correct: verdict.correct,
    misconceptionId: verdict.misconceptionId,
    concepts: verdict.concepts.slice(),
  };
}

function gradeExamQuestion(
  question: Question,
  chosenOptionId: string | null,
): ExamVerdict {
  const correct = chosenOptionId === question.correctOptionId;
  let misconceptionId: string | null = null;
  if (chosenOptionId !== null && !correct) {
    for (const option of question.options) {
      if (option.id === chosenOptionId) {
        misconceptionId = option.misconceptionId ?? null;
        break;
      }
    }
  }
  return {
    questionId: question.id,
    chosenOptionId,
    correct,
    misconceptionId,
    concepts: question.concepts.slice(),
  };
}

function gradeExam(manifest: ContentManifest, exam: ExamState): ExamVerdict[] {
  const verdicts: ExamVerdict[] = [];
  for (const questionId of exam.questionIds) {
    const question = findQuestion(manifest, questionId);
    const chosenOptionId = Object.prototype.hasOwnProperty.call(
      exam.answers,
      questionId,
    )
      ? exam.answers[questionId]
      : null;
    if (question === null) {
      verdicts.push({
        questionId,
        chosenOptionId,
        correct: false,
        misconceptionId: null,
        concepts: [],
      });
      continue;
    }
    verdicts.push(gradeExamQuestion(question, chosenOptionId));
  }
  return verdicts;
}

/**
 * Deterministic retake rotation: the question ORDER of a retake is the
 * configured form rotated one position past the previous run's starting
 * question. Same ledger, same order — the referee stays deterministic — but
 * consecutive retakes do not present an identical sequence (cross-review
 * MAJOR 13, partial mitigation; the item SET is fixed by design — the form
 * is a public, inspectable artifact of the deterministic engine).
 */
function rotatedQuestionIds(
  configIds: readonly string[],
  previousExam: ExamState | null,
): string[] {
  const ids = configIds.slice();
  if (previousExam === null || ids.length === 0) {
    return ids;
  }
  const previousFirst = previousExam.questionIds[0];
  const index = previousFirst === undefined ? -1 : ids.indexOf(previousFirst);
  if (index < 0) {
    return ids;
  }
  const offset = (index + 1) % ids.length;
  return [...ids.slice(offset), ...ids.slice(0, offset)];
}

export function applyCreateExam(
  manifest: ContentManifest,
  ledger: Ledger,
  now: number,
): { ledger: Ledger; status: ExamStatus } {
  const config = resolveExamConfig(manifest);
  const next = cloneLedger(ledger);
  next.exam = {
    startedAt: now,
    durationSeconds: config.durationSeconds,
    lastSeenAt: now,
    questionIds: rotatedQuestionIds(config.questionIds, ledger.exam),
    answers: {},
    submitted: false,
    submittedAt: null,
    verdicts: [],
  };
  next.phase = 'exam';
  return { ledger: next, status: toExamStatus(next.exam, now) };
}

export function applySubmitExam(
  manifest: ContentManifest,
  ledger: Ledger,
  submittedAt: number,
): Ledger {
  const exam = ledger.exam;
  if (exam === null || exam.submitted) {
    return ledger;
  }
  const verdicts = gradeExam(manifest, exam);
  const next = cloneLedger(ledger);
  if (next.exam === null) {
    return ledger;
  }
  next.exam.submitted = true;
  next.exam.submittedAt = submittedAt;
  next.exam.verdicts = verdicts;
  return next;
}

export function applyExpireIfNeeded(
  manifest: ContentManifest,
  ledger: Ledger,
  now: number,
): Ledger {
  const exam = ledger.exam;
  if (exam === null || exam.submitted) {
    return ledger;
  }
  if (!isExamExpired(exam, now)) {
    return ledger;
  }
  const submittedAt = exam.startedAt + exam.durationSeconds * 1000;
  return applySubmitExam(manifest, ledger, submittedAt);
}

export function applyRecordExamAnswer(
  manifest: ContentManifest,
  ledger: Ledger,
  optionId: string,
): { ledger: Ledger; result: ExamAnswerResult } {
  const exam = ledger.exam;
  if (exam === null || exam.submitted) {
    throw new Error('refused: no-active-exam');
  }
  const question = findCurrentExamQuestion(manifest, exam);
  if (question === null) {
    throw new Error('no current question');
  }
  let known = false;
  for (const option of question.options) {
    if (option.id === optionId) {
      known = true;
      break;
    }
  }
  if (!known) {
    throw new Error('refused: unknown-option');
  }
  const next = cloneLedger(ledger);
  if (next.exam === null) {
    throw new Error('refused: no-active-exam');
  }
  next.exam.answers[question.id] = optionId;
  return {
    ledger: next,
    result: {
      questionId: question.id,
      optionId,
      // Correctness is not computed here at all — nothing that grades the
      // answer exists in this result. Grading happens once, at submit.
      correct: null,
      misconceptionId: null,
      attemptNumber: 1,
    },
  };
}

export function applyExitExam(ledger: Ledger): Ledger {
  if (ledger.exam === null || !ledger.exam.submitted) {
    return ledger;
  }
  const next = cloneLedger(ledger);
  next.phase = 'practice';
  return next;
}

export function buildExamDebrief(
  exam: ExamState,
  scores: RubricScores,
): ExamDebrief {
  const verdicts = exam.verdicts.map(cloneVerdict);
  const missedConceptIds: string[] = [];
  const seenConcepts = new Set<string>();
  const misconceptionIdsFired: string[] = [];
  const seenMisconceptions = new Set<string>();
  for (const verdict of verdicts) {
    if (verdict.correct) {
      continue;
    }
    for (const concept of verdict.concepts) {
      if (seenConcepts.has(concept)) {
        continue;
      }
      seenConcepts.add(concept);
      missedConceptIds.push(concept);
    }
    if (verdict.misconceptionId !== null) {
      if (!seenMisconceptions.has(verdict.misconceptionId)) {
        seenMisconceptions.add(verdict.misconceptionId);
        misconceptionIdsFired.push(verdict.misconceptionId);
      }
    }
  }
  return {
    scores: {
      recall: scores.recall,
      connections: scores.connections,
      application: scores.application,
      transfer: scores.transfer,
    },
    verdicts,
    missedConceptIds,
    misconceptionIdsFired,
  };
}
