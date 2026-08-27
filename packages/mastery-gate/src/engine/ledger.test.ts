import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import {
  attemptCount,
  createEmptyLedger,
  isRepeatedMisconception,
  misconceptionFireCount,
  missCount,
  recordAttempt,
} from './ledger';
import { fixtureQuestion } from './fixtures';

const q1 = fixtureQuestion('q1');
const q3 = fixtureQuestion('q3');

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('createEmptyLedger has phase lesson, zero scores, empty collections', () => {
  const ledger = createEmptyLedger();
  expect(ledger.phase).toBe('lesson');
  expect(ledger.attempts).toEqual([]);
  expect(ledger.coachNotes).toEqual([]);
  expect(ledger.misconceptionFires).toEqual({});
  expect(ledger.scores).toEqual({
    recall: 0,
    connections: 0,
    application: 0,
    transfer: 0,
  });
  expect(ledger.drillResults).toEqual([]);
  expect(ledger.activeDrill).toBe(null);
  expect(ledger.exam).toBe(null);
  expect(ledger.debrief).toBe(null);
  expect(ledger.learnerName).toBe(null);
});

test('recordAttempt is immutable and does not share arrays or fire maps', () => {
  const ledger = createEmptyLedger();
  const before = snapshot(ledger);
  const grade = gradeAnswer(q1, 'q1-b');
  const next = recordAttempt(ledger, grade, 1000);

  expect(ledger).toEqual(before);
  expect(ledger.attempts === next.attempts).toBe(false);
  expect(ledger.misconceptionFires === next.misconceptionFires).toBe(false);
  expect(ledger.coachNotes === next.coachNotes).toBe(false);
  expect(next.attempts.length).toBe(1);
  expect(next.attempts[0]).toEqual({
    questionId: 'q1',
    optionId: 'q1-b',
    correct: false,
    misconceptionId: 'mc-shared',
    timestamp: 1000,
  });
});

test('attemptCount and missCount track per question across interleaved items', () => {
  let ledger = createEmptyLedger();
  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-b'), 1);
  ledger = recordAttempt(ledger, gradeAnswer(q3, 'q3-a'), 2);
  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-c'), 3);
  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-a'), 4);
  ledger = recordAttempt(ledger, gradeAnswer(q3, 'q3-b'), 5);

  expect(attemptCount(ledger, 'q1')).toBe(3);
  expect(attemptCount(ledger, 'q3')).toBe(2);
  expect(attemptCount(ledger, 'q2')).toBe(0);
  expect(missCount(ledger, 'q1')).toBe(2);
  expect(missCount(ledger, 'q3')).toBe(1);
});

test('misconceptionFires increments only on misses with a misconceptionId', () => {
  let ledger = createEmptyLedger();
  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-a'), 1);
  expect(ledger.misconceptionFires).toEqual({});

  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-c'), 2);
  expect(misconceptionFireCount(ledger, 'mc-q1-legacy')).toBe(1);
  expect(misconceptionFireCount(ledger, 'mc-shared')).toBe(0);

  const orphan = gradeAnswer(q1, 'q1-b');
  const withoutId = {
    questionId: orphan.questionId,
    optionId: orphan.optionId,
    correct: false,
    misconceptionId: null,
  };
  ledger = recordAttempt(ledger, withoutId, 3);
  expect(misconceptionFireCount(ledger, 'mc-shared')).toBe(0);
});

test('fires accumulate across different questions sharing mc-shared', () => {
  let ledger = createEmptyLedger();
  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-b'), 1);
  expect(misconceptionFireCount(ledger, 'mc-shared')).toBe(1);
  ledger = recordAttempt(ledger, gradeAnswer(q3, 'q3-a'), 2);
  expect(misconceptionFireCount(ledger, 'mc-shared')).toBe(2);
});

test('isRepeatedMisconception is false at 1 fire and true at 2', () => {
  let ledger = createEmptyLedger();
  expect(isRepeatedMisconception(ledger, 'mc-shared')).toBe(false);

  ledger = recordAttempt(ledger, gradeAnswer(q1, 'q1-b'), 1);
  expect(isRepeatedMisconception(ledger, 'mc-shared')).toBe(false);

  ledger = recordAttempt(ledger, gradeAnswer(q3, 'q3-a'), 2);
  expect(isRepeatedMisconception(ledger, 'mc-shared')).toBe(true);
});
