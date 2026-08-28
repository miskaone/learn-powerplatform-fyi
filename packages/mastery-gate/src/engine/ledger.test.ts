import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import {
  attemptCount,
  clampAgentReportRecords,
  clampCoachNotes,
  clampLessonTextRecord,
  createEmptyLedger,
  isRepeatedMisconception,
  MAX_AGENT_REPORT_RECORDS,
  MAX_COACH_NOTE_LENGTH,
  MAX_COACH_NOTES,
  MAX_LESSON_AIM_LENGTH,
  MAX_LESSON_TEXT_ENTRIES,
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
  expect(ledger.confidenceHints).toEqual([]);
  expect(ledger.rubricProposals).toEqual([]);
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
  expect(ledger.lessonAims).toEqual({});
  expect(ledger.ruleCompressions).toEqual({});
  expect(ledger.runCommitments).toEqual({});
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
  expect(ledger.confidenceHints === next.confidenceHints).toBe(false);
  expect(ledger.rubricProposals === next.rubricProposals).toBe(false);
  expect(ledger.lessonAims === next.lessonAims).toBe(false);
  expect(ledger.ruleCompressions === next.ruleCompressions).toBe(false);
  expect(ledger.runCommitments === next.runCommitments).toBe(false);
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

test('clampLessonTextRecord drops empty values, truncates, and caps at 24 sorted keys', () => {
  const clamped = clampLessonTextRecord(
    {
      'keep-me': '  hello  ',
      'too-long': 'x'.repeat(MAX_LESSON_AIM_LENGTH + 20),
      blank: '   ',
      empty: '',
    },
    MAX_LESSON_AIM_LENGTH,
  );
  expect(clamped['keep-me']).toBe('hello');
  expect(clamped['too-long']?.length).toBe(MAX_LESSON_AIM_LENGTH);
  expect(Object.prototype.hasOwnProperty.call(clamped, 'blank')).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(clamped, 'empty')).toBe(false);

  const oversized: Record<string, string> = {};
  for (let i = 0; i < 30; i += 1) {
    oversized[`k${String(i).padStart(2, '0')}`] = `v${i}`;
  }
  const capped = clampLessonTextRecord(oversized, MAX_LESSON_AIM_LENGTH);
  expect(Object.keys(capped)).toEqual(
    Array.from({ length: MAX_LESSON_TEXT_ENTRIES }, (_, i) => {
      return `k${String(i).padStart(2, '0')}`;
    }),
  );
});

test('clampCoachNotes truncates text, rebuilds field-by-field, and keeps the most recent notes', () => {
  const long = 'x'.repeat(MAX_COACH_NOTE_LENGTH + 40);
  const clamped = clampCoachNotes([
    { text: long, kind: 'preference' },
    { text: 'keep', kind: 'context' },
  ]);
  expect(clamped).toEqual([
    { text: 'x'.repeat(MAX_COACH_NOTE_LENGTH), kind: 'preference' },
    { text: 'keep', kind: 'context' },
  ]);
  expect(clamped[0] === undefined).toBe(false);

  const many = Array.from({ length: MAX_COACH_NOTES + 5 }, (_, i) => ({
    text: `n${i}`,
    kind: 'observation' as const,
  }));
  const capped = clampCoachNotes(many);
  expect(capped.length).toBe(MAX_COACH_NOTES);
  expect(capped[0]).toEqual({ text: 'n5', kind: 'observation' });
  expect(capped[MAX_COACH_NOTES - 1]).toEqual({
    text: `n${MAX_COACH_NOTES + 4}`,
    kind: 'observation',
  });
});

test('clampAgentReportRecords keeps the most recent MAX_AGENT_REPORT_RECORDS', () => {
  const records = Array.from({ length: MAX_AGENT_REPORT_RECORDS + 7 }, (_, i) => ({
    n: i,
  }));
  const clamped = clampAgentReportRecords(records);
  expect(clamped.length).toBe(MAX_AGENT_REPORT_RECORDS);
  expect(clamped[0]).toEqual({ n: 7 });
  expect(clamped[MAX_AGENT_REPORT_RECORDS - 1]).toEqual({
    n: MAX_AGENT_REPORT_RECORDS + 6,
  });
  expect(clampAgentReportRecords([{ n: 1 }])).toEqual([{ n: 1 }]);
});
