import type {
  AttemptRecord,
  DebriefSegment,
  DebriefState,
  DrillResultRecord,
  DrillSessionState,
  ExamState,
  ExamVerdict,
  Ledger,
} from '../schema';
import type { GradeResult } from './grading';

/** Storage sanity caps for agent-authored coaching notes. */
export const MAX_COACH_NOTES = 50;
export const MAX_COACH_NOTE_LENGTH = 500;
export const MAX_LEARNER_NAME_LENGTH = 40;

/**
 * Clamp coaching notes to the storage caps: each note truncated to
 * MAX_COACH_NOTE_LENGTH chars, only the most recent MAX_COACH_NOTES kept.
 */
export function clampCoachNotes(notes: readonly string[]): string[] {
  const clamped = notes.map((note) => note.slice(0, MAX_COACH_NOTE_LENGTH));
  if (clamped.length <= MAX_COACH_NOTES) {
    return clamped;
  }
  return clamped.slice(clamped.length - MAX_COACH_NOTES);
}

export function createEmptyLedger(): Ledger {
  return {
    attempts: [],
    misconceptionFires: {},
    scores: {
      recall: 0,
      connections: 0,
      application: 0,
      transfer: 0,
    },
    coachNotes: [],
    phase: 'lesson',
    drillResults: [],
    activeDrill: null,
    exam: null,
    debrief: null,
    learnerName: null,
  };
}

function copyNumberRecord(record: Record<string, number>): Record<string, number> {
  const copy: Record<string, number> = {};
  for (const key of Object.keys(record)) {
    copy[key] = record[key];
  }
  return copy;
}

function copyStringRecord(record: Record<string, string>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    copy[key] = record[key];
  }
  return copy;
}

function cloneAttempt(attempt: AttemptRecord): AttemptRecord {
  return {
    questionId: attempt.questionId,
    optionId: attempt.optionId,
    correct: attempt.correct,
    misconceptionId: attempt.misconceptionId,
    timestamp: attempt.timestamp,
  };
}

function cloneDrillResult(record: DrillResultRecord): DrillResultRecord {
  return {
    scenarioId: record.scenarioId,
    assumptionId: record.assumptionId,
    prediction: record.prediction,
    reason: record.reason,
    outcomeId: record.outcomeId,
    outcomeComponent: record.outcomeComponent,
    predictionWasCorrect: record.predictionWasCorrect,
    dimension: 'transfer',
    timestamp: record.timestamp,
  };
}

function cloneActiveDrill(
  session: DrillSessionState | null,
): DrillSessionState | null {
  if (session === null) {
    return null;
  }
  return {
    scenarioId: session.scenarioId,
    round: session.round,
    usedAssumptionIds: session.usedAssumptionIds.slice(),
    currentAssumptionId: session.currentAssumptionId,
    prediction:
      session.prediction === null
        ? null
        : {
            text: session.prediction.text,
            reason: session.prediction.reason,
          },
  };
}

function cloneExamVerdict(verdict: ExamVerdict): ExamVerdict {
  return {
    questionId: verdict.questionId,
    chosenOptionId: verdict.chosenOptionId,
    correct: verdict.correct,
    misconceptionId: verdict.misconceptionId,
    concepts: verdict.concepts.slice(),
  };
}

function cloneExam(exam: ExamState | null): ExamState | null {
  if (exam === null) {
    return null;
  }
  return {
    startedAt: exam.startedAt,
    durationSeconds: exam.durationSeconds,
    questionIds: exam.questionIds.slice(),
    answers: copyStringRecord(exam.answers),
    submitted: exam.submitted,
    submittedAt: exam.submittedAt,
    verdicts: exam.verdicts.map(cloneExamVerdict),
  };
}

function cloneDebriefSegment(segment: DebriefSegment): DebriefSegment {
  const cloned: DebriefSegment = {
    id: segment.id,
    kind: segment.kind,
    scriptLine: segment.scriptLine,
    audioAsset: segment.audioAsset,
  };
  if (segment.misconceptionId !== undefined) {
    cloned.misconceptionId = segment.misconceptionId;
  }
  return cloned;
}

function cloneDebrief(debrief: DebriefState | null): DebriefState | null {
  if (debrief === null) {
    return null;
  }
  return {
    playlist: debrief.playlist.map(cloneDebriefSegment),
    currentIndex: debrief.currentIndex,
  };
}

/**
 * Field-by-field structural clone. Arrays are sliced/mapped, records copied
 * key-by-key, nested objects rebuilt — never spread of unknown objects.
 */
export function cloneLedger(ledger: Ledger): Ledger {
  return {
    attempts: ledger.attempts.map(cloneAttempt),
    misconceptionFires: copyNumberRecord(ledger.misconceptionFires),
    scores: {
      recall: ledger.scores.recall,
      connections: ledger.scores.connections,
      application: ledger.scores.application,
      transfer: ledger.scores.transfer,
    },
    coachNotes: ledger.coachNotes.slice(),
    phase: ledger.phase,
    drillResults: ledger.drillResults.map(cloneDrillResult),
    activeDrill: cloneActiveDrill(ledger.activeDrill),
    exam: cloneExam(ledger.exam),
    debrief: cloneDebrief(ledger.debrief),
    learnerName: ledger.learnerName,
  };
}

export function recordAttempt(
  ledger: Ledger,
  grade: GradeResult,
  timestamp: number,
): Ledger {
  const attempt: AttemptRecord = {
    questionId: grade.questionId,
    optionId: grade.optionId,
    correct: grade.correct,
    misconceptionId: grade.misconceptionId,
    timestamp,
  };

  const next = cloneLedger(ledger);
  next.attempts = [...next.attempts, attempt];
  if (!grade.correct && grade.misconceptionId !== null) {
    next.misconceptionFires[grade.misconceptionId] =
      (next.misconceptionFires[grade.misconceptionId] ?? 0) + 1;
  }
  return next;
}

export function attemptCount(ledger: Ledger, questionId: string): number {
  let count = 0;
  for (const attempt of ledger.attempts) {
    if (attempt.questionId === questionId) {
      count += 1;
    }
  }
  return count;
}

export function missCount(ledger: Ledger, questionId: string): number {
  let count = 0;
  for (const attempt of ledger.attempts) {
    if (attempt.questionId === questionId && !attempt.correct) {
      count += 1;
    }
  }
  return count;
}

export function misconceptionFireCount(
  ledger: Ledger,
  misconceptionId: string,
): number {
  return ledger.misconceptionFires[misconceptionId] ?? 0;
}

export function isRepeatedMisconception(
  ledger: Ledger,
  misconceptionId: string,
): boolean {
  return misconceptionFireCount(ledger, misconceptionId) >= 2;
}
