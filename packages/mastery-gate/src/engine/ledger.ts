import type { AttemptRecord, Ledger } from '../schema';
import type { GradeResult } from './grading';

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

  const misconceptionFires: Record<string, number> = {};
  for (const key of Object.keys(ledger.misconceptionFires)) {
    misconceptionFires[key] = ledger.misconceptionFires[key];
  }
  if (!grade.correct && grade.misconceptionId !== null) {
    misconceptionFires[grade.misconceptionId] =
      (misconceptionFires[grade.misconceptionId] ?? 0) + 1;
  }

  return {
    attempts: [...ledger.attempts, attempt],
    misconceptionFires,
    scores: {
      recall: ledger.scores.recall,
      connections: ledger.scores.connections,
      application: ledger.scores.application,
      transfer: ledger.scores.transfer,
    },
    coachNotes: ledger.coachNotes.slice(),
    phase: ledger.phase,
  };
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
