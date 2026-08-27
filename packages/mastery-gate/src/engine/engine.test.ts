import { test, expect } from 'bun:test';
import { MasteryEngine } from './engine';
import { FIXTURE_MANIFEST, Q1_RATIONALE } from './fixtures';
import { MemoryStorageAdapter } from './storage';

function passingSubmission(transferScore: number) {
  return {
    recall: { score: 3, quote: 'recall evidence quote' },
    connections: { score: 3, quote: 'connections evidence quote' },
    application: { score: 3, quote: 'application evidence quote' },
    transfer: { score: transferScore, quote: 'transfer evidence quote' },
  };
}

test('full loop on the fixture manifest', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 1000,
  });

  const current = engine.getCurrentQuestion();
  expect(current === null).toBe(false);
  if (current === null) {
    return;
  }
  expect(current.id).toBe('q1');
  expect(Object.keys(current)).toEqual([
    'id',
    'objectiveId',
    'concepts',
    'prompt',
    'options',
  ]);

  const miss1 = engine.submitAnswer('q1-b');
  expect(miss1.correct).toBe(false);
  expect(miss1.misconceptionId).toBe('mc-shared');
  expect(miss1.attemptNumber).toBe(1);
  const missJson = JSON.stringify(miss1);
  expect(missJson).not.toContain('correctOptionId');
  expect(missJson).not.toContain(Q1_RATIONALE);

  const hit = engine.submitAnswer('q1-a');
  expect(hit.correct).toBe(true);
  expect(hit.attemptNumber).toBe(2);
  const next = engine.getCurrentQuestion();
  expect(next === null).toBe(false);
  if (next === null) {
    return;
  }
  expect(next.id).toBe('q2');

  const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 2000,
  });
  expect(resumed.getLearnerState()).toEqual(engine.getLearnerState());
  expect(resumed.getCurrentQuestion()).toEqual(engine.getCurrentQuestion());

  const scored = engine.scoreRubric(passingSubmission(3));
  expect(scored.ok).toBe(true);
  expect(engine.requestNextAction()).toBe('advance');

  const closed = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  const closedScore = closed.scoreRubric(passingSubmission(2));
  expect(closedScore.ok).toBe(true);
  expect(closed.requestNextAction() === 'advance').toBe(false);

  const stateJson = JSON.stringify(engine.getLearnerState());
  expect(stateJson).not.toContain('average');
  expect(stateJson).not.toContain('mean');
  expect(stateJson).not.toContain('overall');
  expect(stateJson).not.toContain('correctOptionId');

  engine.reset();
  expect(engine.getLearnerState().attemptsCount).toBe(0);
  const afterReset = engine.getCurrentQuestion();
  expect(afterReset === null).toBe(false);
  if (afterReset === null) {
    return;
  }
  expect(afterReset.id).toBe('q1');
  const fresh = new MasteryEngine(FIXTURE_MANIFEST, adapter);
  expect(fresh.getLearnerState().attemptsCount).toBe(0);
});

test('two wrong answers exhaust a question and advance to the next', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  engine.submitAnswer('q1-b');
  engine.submitAnswer('q1-c');
  const next = engine.getCurrentQuestion();
  expect(next === null).toBe(false);
  if (next === null) {
    return;
  }
  expect(next.id).toBe('q2');
  expect(engine.getLearnerState().attemptsCount).toBe(2);
});

test('submitAnswer throws when no current question remains', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  engine.submitAnswer('q1-a');
  engine.submitAnswer('q2-b');
  engine.submitAnswer('q3-b');
  engine.submitAnswer('q4-a');
  expect(engine.getCurrentQuestion()).toBe(null);

  let thrown: unknown = null;
  try {
    engine.submitAnswer('q1-a');
  } catch (error) {
    thrown = error;
  }
  expect(thrown instanceof Error).toBe(true);
  expect((thrown as Error).message).toBe('no current question');

  const exhausted = engine.requestHint();
  expect(exhausted.granted).toBe(false);
  if (exhausted.granted) {
    return;
  }
  expect(exhausted.questionId).toBe('');
  expect(exhausted.reason).toBe('ladder-exhausted');
});

test('requestHint persists granted tiers', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter);
  const result = engine.requestHint();
  expect(result.granted).toBe(true);
  const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter);
  const second = resumed.requestHint();
  expect(second.granted).toBe(false);
  if (second.granted) {
    return;
  }
  expect(second.reason).toBe('tier2-requires-attempt');
});
