import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import {
  createHintState,
  requestHint,
} from './hints';
import { createEmptyLedger, recordAttempt } from './ledger';
import { fixtureQuestion } from './fixtures';

const q1 = fixtureQuestion('q1');

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('tier 1 is granted pre-attempt with concept guidance', () => {
  const state = createHintState();
  const before = snapshot(state);
  const { state: next, result } = requestHint(state, createEmptyLedger(), q1);

  expect(result.granted).toBe(true);
  if (!result.granted) {
    return;
  }
  expect(result.tier).toBe(1);
  expect(result.questionId).toBe('q1');
  expect(result.guidance).toContain('execution pipeline, sandbox boundary');
  expect(result.guidance).not.toContain(q1.correctOptionId);
  expect(result.guidance).not.toContain('IOrganizationService');
  expect(result.guidance).not.toContain(q1.rationale);

  expect(state).toEqual(before);
  expect(next === state).toBe(false);
  expect(next.tiersIssued === state.tiersIssued).toBe(false);
  expect(next.tiersIssued['q1']).toBe(1);
  expect(state.tiersIssued['q1']).toBe(undefined);
});

test('tier 2 refused pre-attempt and state is unchanged', () => {
  const empty = createHintState();
  const afterTier1 = requestHint(empty, createEmptyLedger(), q1).state;
  const before = snapshot(afterTier1);
  const { state: next, result } = requestHint(
    afterTier1,
    createEmptyLedger(),
    q1,
  );

  expect(result.granted).toBe(false);
  if (result.granted) {
    return;
  }
  expect(result.reason).toBe('tier2-requires-attempt');
  expect(result.questionId).toBe('q1');
  expect(next === afterTier1).toBe(true);
  expect(afterTier1).toEqual(before);
});

test('tier 2 granted after a graded attempt eliminates a distractor', () => {
  const afterTier1 = requestHint(
    createHintState(),
    createEmptyLedger(),
    q1,
  ).state;
  const ledger = recordAttempt(
    createEmptyLedger(),
    gradeAnswer(q1, 'q1-b'),
    1,
  );
  const before = snapshot(afterTier1);
  const { state: next, result } = requestHint(afterTier1, ledger, q1);

  expect(result.granted).toBe(true);
  if (!result.granted) {
    return;
  }
  expect(result.tier).toBe(2);
  expect(result.eliminatedOptionId).toBe('q1-b');
  expect(result.eliminatedOptionId === q1.correctOptionId).toBe(false);
  expect(result.guidance).toContain('q1-b');
  expect(result.guidance).not.toContain(q1.correctOptionId);
  expect(result.guidance).not.toContain('IOrganizationService');

  expect(afterTier1).toEqual(before);
  expect(next === afterTier1).toBe(false);
  expect(next.tiersIssued['q1']).toBe(2);
});

test('third request is ladder-exhausted', () => {
  const ledger = recordAttempt(
    createEmptyLedger(),
    gradeAnswer(q1, 'q1-b'),
    1,
  );
  let state = createHintState();
  state = requestHint(state, ledger, q1).state;
  state = requestHint(state, ledger, q1).state;
  const before = snapshot(state);
  const { state: next, result } = requestHint(state, ledger, q1);

  expect(result.granted).toBe(false);
  if (result.granted) {
    return;
  }
  expect(result.reason).toBe('ladder-exhausted');
  expect(next === state).toBe(true);
  expect(state).toEqual(before);
});
