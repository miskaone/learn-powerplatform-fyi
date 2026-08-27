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
  closed.submitAnswer('q1-a');
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

test('scoreRubric rejects any submission before the first graded attempt', () => {
  // Cross-review BLOCKER (2026-08-27): a cold ledger must never accept a
  // rubric — the gate cannot be self-awarded before a single answer lands.
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  const verdict = engine.scoreRubric(passingSubmission(3));
  expect(verdict.ok).toBe(false);
  if (!verdict.ok) {
    expect(verdict.errors.join(';')).toContain('no-attempts');
  }
  expect(engine.getLearnerState().gatePassed).toBe(false);
  expect(engine.requestNextAction() === 'advance').toBe(false);
});

test('routing verdict survives a reload: hint offer persists with the ledger', () => {
  // Cross-review MAJOR (2026-08-27): lastGrade was in-memory only, so a
  // reload silently dropped mid-flight remediation (ISC-18 for routing).
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 1000,
  });
  engine.submitAnswer('q1-b');
  expect(engine.requestNextAction()).toBe('hint');
  const reloaded = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 2000,
  });
  expect(reloaded.requestNextAction()).toBe('hint');
});

test('engine constructs fresh over a wrong-shaped persisted record', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    'mastery-gate:v1',
    JSON.stringify({ version: 1, ledger: {}, hints: {} }),
  );
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter);
  expect(engine.getLearnerState().attemptsCount).toBe(0);
  const current = engine.getCurrentQuestion();
  expect(current?.id).toBe('q1');
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

test('coaching notes persist on the ledger and round-trip through a reload', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 1000,
  });
  engine.logCoachingNote('Learner conflates pre-validation with pre-operation.');
  engine.logCoachingNote('  second note with padding  ');
  expect(engine.getCoachNotes()).toEqual([
    'Learner conflates pre-validation with pre-operation.',
    'second note with padding',
  ]);

  // Reload: a fresh engine on the same adapter restores the notes.
  const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 2000,
  });
  expect(resumed.getCoachNotes()).toEqual([
    'Learner conflates pre-validation with pre-operation.',
    'second note with padding',
  ]);
});

test('coaching notes are validated, clamped to 500 chars, and capped at the last 50', () => {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter);

  // Empty / whitespace-only / non-string input is ignored, never stored.
  engine.logCoachingNote('');
  engine.logCoachingNote('   ');
  engine.logCoachingNote(123 as unknown as string);
  expect(engine.getCoachNotes()).toEqual([]);

  // Over-long notes clamp to 500 characters.
  engine.logCoachingNote('x'.repeat(900));
  expect(engine.getCoachNotes()[0]!.length).toBe(500);

  // Only the most recent 50 notes are kept.
  for (let i = 0; i < 60; i += 1) {
    engine.logCoachingNote(`note-${i}`);
  }
  const notes = engine.getCoachNotes();
  expect(notes.length).toBe(50);
  expect(notes[0]).toBe('note-10');
  expect(notes[49]).toBe('note-59');

  // The cap also holds through persistence.
  const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter);
  expect(resumed.getCoachNotes()).toEqual(notes);
});
