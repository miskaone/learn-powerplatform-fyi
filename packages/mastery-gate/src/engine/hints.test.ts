import { test, expect } from 'bun:test';
import type { Misconception, Question } from '../schema';
import { gradeAnswer } from './grading';
import {
  createHintState,
  requestHint,
} from './hints';
import { createEmptyLedger, recordAttempt } from './ledger';
import { FIXTURE_MANIFEST, fixtureQuestion } from './fixtures';

const q1 = fixtureQuestion('q1');
const misconceptions = FIXTURE_MANIFEST.misconceptions;

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('tier 1 is granted pre-attempt with concept guidance', () => {
  const state = createHintState();
  const before = snapshot(state);
  const { state: next, result } = requestHint(
    state,
    createEmptyLedger(),
    q1,
    misconceptions,
  );

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
  const afterTier1 = requestHint(
    empty,
    createEmptyLedger(),
    q1,
    misconceptions,
  ).state;
  const before = snapshot(afterTier1);
  const { state: next, result } = requestHint(
    afterTier1,
    createEmptyLedger(),
    q1,
    misconceptions,
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

test('tier 2 granted after a graded attempt uses misconception contrast', () => {
  const afterTier1 = requestHint(
    createHintState(),
    createEmptyLedger(),
    q1,
    misconceptions,
  ).state;
  const ledger = recordAttempt(
    createEmptyLedger(),
    gradeAnswer(q1, 'q1-b'),
    1,
  );
  const before = snapshot(afterTier1);
  const { state: next, result } = requestHint(
    afterTier1,
    ledger,
    q1,
    misconceptions,
  );

  expect(result.granted).toBe(true);
  if (!result.granted) {
    return;
  }
  expect(result.tier).toBe(2);
  expect(result.guidance).toContain('HTTP from the sandbox');
  expect(result.guidance).toContain(
    'In-process IOrganizationService vs outbound HTTP.',
  );
  expect('eliminatedOptionId' in result).toBe(false);
  for (const option of q1.options) {
    expect(result.guidance).not.toContain(option.id);
  }

  expect(afterTier1).toEqual(before);
  expect(next === afterTier1).toBe(false);
  expect(next.tiersIssued['q1']).toBe(2);
});

test('tier 2 contrast never names an option id even when the correct option is not first', () => {
  const question: Question = {
    id: 'q-four',
    objectiveId: 'obj-1',
    concepts: ['sandbox boundary', 'in-process service'],
    prompt: 'Pick the in-process service a plug-in should use.',
    options: [
      {
        id: 'opt-http',
        text: 'An outbound HTTP client',
        misconceptionId: 'mc-http-four',
      },
      {
        id: 'opt-legacy',
        text: 'The retired organization data service',
        misconceptionId: 'mc-legacy-four',
      },
      { id: 'opt-correct', text: 'The in-process organization service' },
      {
        id: 'opt-formula',
        text: 'A canvas formula collection',
        misconceptionId: 'mc-formula-four',
      },
    ],
    correctOptionId: 'opt-correct',
    rationale: 'secret rationale must not leak',
    remediationAnchor: 'anchor-secret',
  };
  const bank: readonly Misconception[] = [
    {
      id: 'mc-http-four',
      name: 'HTTP from the sandbox',
      contrast: 'Use the in-process service instead of outbound HTTP.',
      socraticSeeds: ['What does the sandbox block?'],
      anchor: 'anchor-secret',
    },
    {
      id: 'mc-legacy-four',
      name: 'Legacy organization data service',
      contrast: 'That service is retired.',
      socraticSeeds: ['Which service still exists?'],
      anchor: 'anchor-secret',
    },
    {
      id: 'mc-formula-four',
      name: 'Connector as a collection',
      contrast: 'Connectors are contracts, not collections.',
      socraticSeeds: ['What file describes the connector?'],
      anchor: 'anchor-secret',
    },
  ];
  const afterTier1 = requestHint(
    createHintState(),
    createEmptyLedger(),
    question,
    bank,
  ).state;
  const ledger = recordAttempt(
    createEmptyLedger(),
    gradeAnswer(question, 'opt-http'),
    1,
  );
  const { result } = requestHint(afterTier1, ledger, question, bank);

  expect(result.granted).toBe(true);
  if (!result.granted) {
    return;
  }
  expect(result.tier).toBe(2);
  expect(result.guidance).toContain(
    'Use the in-process service instead of outbound HTTP.',
  );
  expect(result.guidance).toContain('HTTP from the sandbox');
  expect('eliminatedOptionId' in result).toBe(false);
  for (const option of question.options) {
    expect(result.guidance.includes(option.id)).toBe(false);
  }
});

test('third request is ladder-exhausted', () => {
  const ledger = recordAttempt(
    createEmptyLedger(),
    gradeAnswer(q1, 'q1-b'),
    1,
  );
  let state = createHintState();
  state = requestHint(state, ledger, q1, misconceptions).state;
  state = requestHint(state, ledger, q1, misconceptions).state;
  const before = snapshot(state);
  const { state: next, result } = requestHint(
    state,
    ledger,
    q1,
    misconceptions,
  );

  expect(result.granted).toBe(false);
  if (result.granted) {
    return;
  }
  expect(result.reason).toBe('ladder-exhausted');
  expect(next === state).toBe(true);
  expect(state).toEqual(before);
});
