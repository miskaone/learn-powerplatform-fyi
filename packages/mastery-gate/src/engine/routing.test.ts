import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import {
  createEmptyLedger,
  recordAttempt,
} from './ledger';
import { routeNextAction } from './routing';
import { fixtureQuestion } from './fixtures';
import type { Ledger, RubricScores } from '../schema';

const q1 = fixtureQuestion('q1');
const q3 = fixtureQuestion('q3');

function withScores(ledger: Ledger, scores: RubricScores): Ledger {
  return {
    attempts: ledger.attempts,
    misconceptionFires: ledger.misconceptionFires,
    scores,
    coachNotes: ledger.coachNotes,
    phase: ledger.phase,
  };
}

test('routing (a) first miss → hint', () => {
  const grade = gradeAnswer(q1, 'q1-b');
  const ledger = recordAttempt(createEmptyLedger(), grade, 1);
  expect(
    routeNextAction({ ledger, lastGrade: grade }),
  ).toBe('hint');
});

test('routing (b) second miss same question → review', () => {
  const first = gradeAnswer(q1, 'q1-b');
  const second = gradeAnswer(q1, 'q1-c');
  let ledger = recordAttempt(createEmptyLedger(), first, 1);
  ledger = recordAttempt(ledger, second, 2);
  expect(
    routeNextAction({ ledger, lastGrade: second }),
  ).toBe('review');
});

test('routing (c) shared misconception second fire → coach wins over hint', () => {
  const q1Miss = gradeAnswer(q1, 'q1-b');
  const q3Miss = gradeAnswer(q3, 'q3-a');
  let ledger = recordAttempt(createEmptyLedger(), q1Miss, 1);
  ledger = recordAttempt(ledger, q3Miss, 2);
  expect(q3Miss.misconceptionId).toBe('mc-shared');
  expect(
    routeNextAction({ ledger, lastGrade: q3Miss }),
  ).toBe('coach');
});

test("routing (d) correct + confidence 'low' → go_deeper", () => {
  const grade = gradeAnswer(q1, 'q1-a');
  const ledger = recordAttempt(createEmptyLedger(), grade, 1);
  expect(
    routeNextAction({ ledger, lastGrade: grade, confidence: 'low' }),
  ).toBe('go_deeper');
});

test('routing (e) scores 3/3/3/3 → advance regardless of lastGrade', () => {
  const miss = gradeAnswer(q1, 'q1-b');
  const ledger = withScores(recordAttempt(createEmptyLedger(), miss, 1), {
    recall: 3,
    connections: 3,
    application: 3,
    transfer: 3,
  });
  expect(
    routeNextAction({
      ledger,
      lastGrade: miss,
      confidence: 'low',
    }),
  ).toBe('advance');
});

test("routing (f) correct + 'high' with gate closed → continue", () => {
  const grade = gradeAnswer(q1, 'q1-a');
  const ledger = recordAttempt(createEmptyLedger(), grade, 1);
  expect(
    routeNextAction({ ledger, lastGrade: grade, confidence: 'high' }),
  ).toBe('continue');
});

test('routing (g) null lastGrade + gate closed → continue', () => {
  expect(
    routeNextAction({
      ledger: createEmptyLedger(),
      lastGrade: null,
    }),
  ).toBe('continue');
});
