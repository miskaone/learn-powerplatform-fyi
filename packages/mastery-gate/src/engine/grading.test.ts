import { test, expect } from 'bun:test';
import { gradeAnswer } from './grading';
import { FIXTURE_MANIFEST, Q1_RATIONALE, fixtureQuestion } from './fixtures';

const q1 = fixtureQuestion('q1');

test('correct option grades true with null misconceptionId', () => {
  const result = gradeAnswer(q1, q1.correctOptionId);
  expect(result.questionId).toBe('q1');
  expect(result.optionId).toBe(q1.correctOptionId);
  expect(result.correct).toBe(true);
  expect(result.misconceptionId).toBe(null);
});

test('each distractor returns its misconceptionId', () => {
  for (const option of q1.options) {
    if (option.id === q1.correctOptionId) {
      continue;
    }
    const result = gradeAnswer(q1, option.id);
    expect(result.correct).toBe(false);
    expect(result.misconceptionId).toBe(option.misconceptionId as string);
  }
});

test('unknown optionId throws RangeError naming questionId and optionId', () => {
  const optionId = 'q1-missing';
  let thrown: unknown = null;
  try {
    gradeAnswer(q1, optionId);
  } catch (error) {
    thrown = error;
  }
  expect(thrown instanceof RangeError).toBe(true);
  const message = (thrown as RangeError).message;
  expect(message).toContain(q1.id);
  expect(message).toContain(optionId);
});

test('serialized grade contains no answer-key material', () => {
  const serialized = JSON.stringify(gradeAnswer(q1, 'q1-b'));
  expect(serialized).not.toContain('correctOptionId');
  expect(serialized).not.toContain(Q1_RATIONALE);
  expect(serialized).not.toContain('remediationAnchor');
  expect(serialized).not.toContain(q1.remediationAnchor);
});

test('gradeAnswer is deterministic across two calls', () => {
  const first = gradeAnswer(q1, 'q1-c');
  const second = gradeAnswer(q1, 'q1-c');
  expect(first).toEqual(second);

  for (const question of FIXTURE_MANIFEST.questions) {
    for (const option of question.options) {
      expect(gradeAnswer(question, option.id)).toEqual(
        gradeAnswer(question, option.id),
      );
    }
  }
});

test('distractor without misconceptionId yields null', () => {
  const stripped = {
    id: q1.id,
    objectiveId: q1.objectiveId,
    concepts: q1.concepts,
    prompt: q1.prompt,
    options: [
      { id: 'q1-a', text: 'IOrganizationService' },
      { id: 'q1-orphan', text: 'A stray distractor' },
    ],
    correctOptionId: 'q1-a',
    rationale: q1.rationale,
    remediationAnchor: q1.remediationAnchor,
    dimension: q1.dimension,
  };
  const result = gradeAnswer(stripped, 'q1-orphan');
  expect(result.correct).toBe(false);
  expect(result.misconceptionId).toBe(null);
});
