import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import {
  cloneLedger,
  createEmptyLedger,
  recordAttempt,
} from './ledger';
import { routeNextAction } from './routing';
import { fixtureQuestion } from './fixtures';
import type { Ledger, RubricScores } from '../schema';

const q1 = fixtureQuestion('q1');
const q3 = fixtureQuestion('q3');

function withScores(ledger: Ledger, scores: RubricScores): Ledger {
  const next = cloneLedger(ledger);
  next.scores = {
    recall: scores.recall,
    connections: scores.connections,
    application: scores.application,
    transfer: scores.transfer,
  };
  return next;
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

test('routing (h) ready + gate closed + no last grade → rubric_interview', () => {
  expect(
    routeNextAction({
      ledger: createEmptyLedger(),
      lastGrade: null,
      rubricInterviewReady: true,
    }),
  ).toBe('rubric_interview');
});

test('routing (i) ready + last grade miss → miss verdict wins', () => {
  const first = gradeAnswer(q1, 'q1-b');
  const second = gradeAnswer(q1, 'q1-c');
  let ledger = recordAttempt(createEmptyLedger(), first, 1);
  expect(
    routeNextAction({
      ledger,
      lastGrade: first,
      rubricInterviewReady: true,
    }),
  ).toBe('hint');

  ledger = recordAttempt(ledger, second, 2);
  expect(
    routeNextAction({
      ledger,
      lastGrade: second,
      rubricInterviewReady: true,
    }),
  ).toBe('review');

  const q1Miss = gradeAnswer(q1, 'q1-b');
  const q3Miss = gradeAnswer(q3, 'q3-a');
  let coached = recordAttempt(createEmptyLedger(), q1Miss, 1);
  coached = recordAttempt(coached, q3Miss, 2);
  expect(
    routeNextAction({
      ledger: coached,
      lastGrade: q3Miss,
      rubricInterviewReady: true,
    }),
  ).toBe('coach');
});

test("routing (j) ready + correct + low confidence → go_deeper wins", () => {
  const grade = gradeAnswer(q1, 'q1-a');
  const ledger = recordAttempt(createEmptyLedger(), grade, 1);
  expect(
    routeNextAction({
      ledger,
      lastGrade: grade,
      confidence: 'low',
      rubricInterviewReady: true,
    }),
  ).toBe('go_deeper');
});

test('routing (k) ready + gatePassed → advance', () => {
  const ledger = withScores(createEmptyLedger(), {
    recall: 3,
    connections: 3,
    application: 3,
    transfer: 3,
  });
  expect(
    routeNextAction({
      ledger,
      lastGrade: null,
      rubricInterviewReady: true,
    }),
  ).toBe('advance');
});

test('routing (l) not ready → continue unchanged', () => {
  expect(
    routeNextAction({
      ledger: createEmptyLedger(),
      lastGrade: null,
      rubricInterviewReady: false,
    }),
  ).toBe('continue');
});
