import { test, expect } from 'bun:test';
import { MasteryEngine } from './engine';
import {
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_EXAM,
} from './fixtures';
import { MAX_AGENT_REPORT_RECORDS } from './ledger';
import { loadState, MemoryStorageAdapter, saveState, STORAGE_KEY } from './storage';

function passingSubmission(transferScore: number) {
  return {
    recall: { score: 3, quote: 'recall evidence quote' },
    connections: { score: 3, quote: 'connections evidence quote' },
    application: { score: 3, quote: 'application evidence quote' },
    transfer: { score: transferScore, quote: 'transfer evidence quote' },
  };
}

function corpusOf(): string {
  return FIXTURE_MANIFEST_WITH_EXAM.objectives
    .map((objective) => objective.summary)
    .join('\n');
}

function engineOnFreshAdapter(
  manifest = FIXTURE_MANIFEST,
): { engine: MasteryEngine; adapter: MemoryStorageAdapter } {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(manifest, adapter, { now: () => 1000 });
  return { engine, adapter };
}

function examEngine(): { engine: MasteryEngine; adapter: MemoryStorageAdapter } {
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1000,
  });
  engine.submitAnswer('q1-a');
  const scored = engine.scoreRubric(passingSubmission(3));
  expect(scored.ok).toBe(true);
  engine.startExam();
  expect(engine.isExamActive()).toBe(true);
  return { engine, adapter };
}

// ---------------------------------------------------------------------------
// ISC-75: coaching-note kinds
// ---------------------------------------------------------------------------

test('logCoachingNote defaults kind to observation and stores explicit kinds', () => {
  const { engine } = engineOnFreshAdapter();
  expect(engine.logCoachingNote('thinks aloud before committing')).toEqual({
    stored: true,
    reason: null,
  });
  engine.logCoachingNote('prefers worked examples first', 'preference');
  engine.logCoachingNote('works on a field-service Power Platform team', 'context');
  expect(engine.getCoachNotes()).toEqual([
    { text: 'thinks aloud before committing', kind: 'observation' },
    { text: 'prefers worked examples first', kind: 'preference' },
    { text: 'works on a field-service Power Platform team', kind: 'context' },
  ]);
});

test('coaching notes with kinds round-trip through persistence', () => {
  const { engine, adapter } = engineOnFreshAdapter();
  engine.logCoachingNote('prefers analogies from flow runs', 'preference');
  const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => 2000,
  });
  expect(resumed.getCoachNotes()).toEqual([
    { text: 'prefers analogies from flow runs', kind: 'preference' },
  ]);
});

// ---------------------------------------------------------------------------
// ISC-75: answer-cache guard
// ---------------------------------------------------------------------------

test('answer-cache guard rejects notes carrying question ids', () => {
  const { engine } = engineOnFreshAdapter();
  expect(
    engine.logCoachingNote('remember: ml13-q1 was hard for them'),
  ).toEqual({ stored: false, reason: 'answer-content' });
  expect(engine.getCoachNotes()).toEqual([]);
});

test('answer-cache guard rejects notes carrying option ids', () => {
  const { engine } = engineOnFreshAdapter();
  expect(engine.logCoachingNote('the right pick is ML13-Q2-C')).toEqual({
    stored: false,
    reason: 'answer-content',
  });
});

test('answer-cache guard rejects >=20-char verbatim option text, case- and whitespace-insensitively', () => {
  const { engine } = engineOnFreshAdapter();
  // q1-b option text: 'An outbound HTTP client to the Web API'
  expect(
    engine.logCoachingNote('never choose an outbound HTTP client to the Web API here'),
  ).toEqual({ stored: false, reason: 'answer-content' });
  // Case + whitespace variance must not evade the guard.
  expect(
    engine.logCoachingNote('AVOID: an   OUTBOUND http\nclient to the   web api'),
  ).toEqual({ stored: false, reason: 'answer-content' });
});

test('answer-cache guard survives punctuation insertion inside option text (cross-review evasion)', () => {
  const { engine } = engineOnFreshAdapter();
  // Same q1-b option text with punctuation shot through every few chars —
  // normalization strips punctuation, so the verbatim window still matches.
  expect(
    engine.logCoachingNote('an-outbound. HTTP,client;to!the...Web-API'),
  ).toEqual({ stored: false, reason: 'answer-content' });
});

test('answer-cache guard rejects question ids that dodge the hyphen shape', () => {
  const { engine } = engineOnFreshAdapter();
  expect(engine.logCoachingNote('they struggled on ml13.q1 last time')).toEqual({
    stored: false,
    reason: 'answer-content',
  });
  expect(engine.logCoachingNote('see ml13 q2 again next session')).toEqual({
    stored: false,
    reason: 'answer-content',
  });
});

test('answer-cache guard allows benign notes and short option fragments', () => {
  const { engine } = engineOnFreshAdapter();
  expect(
    engine.logCoachingNote(
      'links every stage question back to transaction boundaries — build on that',
    ),
  ).toEqual({ stored: true, reason: null });
  // <20 chars of option text is below the verbatim window.
  expect(engine.logCoachingNote('wary of outbound HTTP')).toEqual({
    stored: true,
    reason: null,
  });
  expect(engine.getCoachNotes().length).toBe(2);
});

test('coaching notes refuse mid-exam before the guard runs', () => {
  const { engine } = examEngine();
  expect(engine.logCoachingNote('benign observation mid-exam')).toEqual({
    stored: false,
    reason: 'exam-active',
  });
});

// ---------------------------------------------------------------------------
// ISC-73: agent report card — confidence hints
// ---------------------------------------------------------------------------

test('requestNextAction records explicit confidence hints against the last outcome', () => {
  const { engine, adapter } = engineOnFreshAdapter();
  // No grade yet: lastCorrect null.
  engine.requestNextAction('high');
  // Correct answer, then high confidence: agreement.
  engine.submitAnswer('q1-a');
  engine.requestNextAction('high');
  // Miss, then high confidence: high-confidence miss.
  engine.submitAnswer('q2-a');
  engine.requestNextAction('high');
  // Miss, then low confidence: agreement.
  engine.requestNextAction('low');
  // No confidence passed: nothing recorded.
  engine.requestNextAction();

  const persisted = loadState(adapter, 3000);
  expect(persisted === null).toBe(false);
  if (persisted === null) {
    return;
  }
  expect(persisted.ledger.confidenceHints.map((hint) => hint.lastCorrect)).toEqual([
    null,
    true,
    false,
    false,
  ]);

  const summary = engine.getCalibrationSummary();
  expect(summary).toEqual({
    confidenceHintCount: 4,
    confidenceAgreements: 2, // high+correct, low+miss
    highConfidenceMisses: 1,
    rubricProposalCount: 0,
    rubricProposalsAccepted: 0,
  });
});

test('confidence-hint recording never changes the routing verdict', () => {
  const plain = engineOnFreshAdapter().engine;
  const recorded = engineOnFreshAdapter().engine;
  plain.submitAnswer('q1-b');
  recorded.submitAnswer('q1-b');
  expect(recorded.requestNextAction('high')).toBe(plain.requestNextAction());
});

test('confidence hints are not recorded mid-exam', () => {
  const { engine, adapter } = examEngine();
  engine.requestNextAction('high');
  const persisted = loadState(adapter, 3000);
  expect(persisted?.ledger.confidenceHints).toEqual([]);
});

// ---------------------------------------------------------------------------
// ISC-73: agent report card — rubric proposals
// ---------------------------------------------------------------------------

test('scoreRubric records accepted and rejected proposals; preconditions record nothing', () => {
  const { engine, adapter } = engineOnFreshAdapter();

  // Blocked by the no-attempts precondition: no record.
  engine.scoreRubric(passingSubmission(3));
  expect(loadState(adapter, 3000)?.ledger.rubricProposals ?? []).toEqual([]);

  engine.submitAnswer('q1-a');

  // Rejected on evidence (empty quote): recorded, not accepted, gate closed.
  const rejected = engine.scoreRubric({
    recall: { score: 3, quote: '' },
    connections: { score: 3, quote: 'c' },
    application: { score: 3, quote: 'a' },
    transfer: { score: 3, quote: 't' },
  });
  expect(rejected.ok).toBe(false);

  // Accepted at mastery: recorded, accepted, gate open.
  const accepted = engine.scoreRubric(passingSubmission(3));
  expect(accepted.ok).toBe(true);

  const proposals = loadState(adapter, 3000)?.ledger.rubricProposals ?? [];
  expect(proposals.map((p) => [p.accepted, p.gatePassed])).toEqual([
    [false, false],
    [true, true],
  ]);

  const summary = engine.getCalibrationSummary();
  expect(summary?.rubricProposalCount).toBe(2);
  expect(summary?.rubricProposalsAccepted).toBe(1);
});

test('calibration summary is null on a cold ledger', () => {
  const { engine } = engineOnFreshAdapter();
  expect(engine.getCalibrationSummary()).toBe(null);
  expect(engine.getLearnerState().coachCalibration).toBe(null);
});

test('getLearnerState exposes coachingNotes and coachCalibration', () => {
  const { engine } = engineOnFreshAdapter();
  engine.logCoachingNote('anchors new ideas to flow-run stories', 'observation');
  engine.requestNextAction('low');
  const state = engine.getLearnerState();
  expect(state.coachingNotes).toEqual([
    { text: 'anchors new ideas to flow-run stories', kind: 'observation' },
  ]);
  expect(state.coachCalibration?.confidenceHintCount).toBe(1);
});

// ---------------------------------------------------------------------------
// ISC-67: misconception evidence map
// ---------------------------------------------------------------------------

test('getMisconceptionEvidence maps fires to their evidencing questions in first-fire order', () => {
  const { engine } = engineOnFreshAdapter();
  engine.submitAnswer('q1-b'); // mc-shared on q1
  engine.submitAnswer('q1-a'); // resolve q1 correctly
  engine.submitAnswer('q2-a'); // mc-q2-transaction on q2
  engine.submitAnswer('q2-b'); // resolve q2
  engine.submitAnswer('q3-a'); // mc-shared again, on q3

  expect(engine.getMisconceptionEvidence()).toEqual([
    { misconceptionId: 'mc-shared', fireCount: 2, questionIds: ['q1', 'q3'] },
    { misconceptionId: 'mc-q2-transaction', fireCount: 1, questionIds: ['q2'] },
  ]);

  const fires = engine.getLearnerState().misconceptionFires;
  for (const entry of engine.getMisconceptionEvidence()) {
    expect(fires[entry.misconceptionId]).toBe(entry.fireCount);
  }
});

test('correct answers contribute no misconception evidence', () => {
  const { engine } = engineOnFreshAdapter();
  engine.submitAnswer('q1-a');
  expect(engine.getMisconceptionEvidence()).toEqual([]);
});

// ---------------------------------------------------------------------------
// ISC-69: defeated-misconception myth naming
// ---------------------------------------------------------------------------

test('correct-on-first-try names the first distractor misconception', () => {
  const { engine } = engineOnFreshAdapter();
  const verdict = engine.submitAnswer('q1-a');
  expect(verdict.correct).toBe(true);
  expect(verdict.defeatedMisconception).toEqual({
    id: 'mc-shared',
    name: 'HTTP from the sandbox',
  });
});

test('miss-then-correct names the misconception the learner actually fired', () => {
  const { engine } = engineOnFreshAdapter();
  engine.submitAnswer('q1-c'); // fires mc-q1-legacy
  const verdict = engine.submitAnswer('q1-a');
  expect(verdict.correct).toBe(true);
  expect(verdict.defeatedMisconception).toEqual({
    id: 'mc-q1-legacy',
    name: 'Legacy organization data service',
  });
});

test('a miss verdict carries no defeated misconception', () => {
  const { engine } = engineOnFreshAdapter();
  const verdict = engine.submitAnswer('q1-b');
  expect(verdict.correct).toBe(false);
  expect(verdict.defeatedMisconception).toBe(null);
});

test('mid-exam answers carry no defeated misconception', () => {
  const { engine } = examEngine();
  const question = engine.getCurrentQuestion();
  expect(question === null).toBe(false);
  if (question === null) {
    return;
  }
  const verdict = engine.submitAnswer(question.options[0].id);
  expect(verdict.correct).toBe(null);
  expect(verdict.defeatedMisconception).toBe(null);
});

// ---------------------------------------------------------------------------
// Storage: migration + rejection for the new fields
// ---------------------------------------------------------------------------

function persistedBase(): Record<string, unknown> {
  return {
    version: 1,
    ledger: {
      attempts: [],
      misconceptionFires: {},
      scores: { recall: 0, connections: 0, application: 0, transfer: 0 },
      coachNotes: [],
      phase: 'lesson',
    },
    hints: { tiersIssued: {} },
    lastGrade: null,
  };
}

function withLedgerField(field: string, value: unknown): MemoryStorageAdapter {
  const adapter = new MemoryStorageAdapter();
  const record = persistedBase();
  (record.ledger as Record<string, unknown>)[field] = value;
  adapter.setItem(STORAGE_KEY, JSON.stringify(record));
  return adapter;
}

test('legacy string coachNotes migrate to observation-kind notes', () => {
  const adapter = withLedgerField('coachNotes', ['old plain note']);
  const loaded = loadState(adapter, 1000);
  expect(loaded?.ledger.coachNotes).toEqual([
    { text: 'old plain note', kind: 'observation' },
  ]);
});

test('a coach note with an invalid kind rejects the ledger', () => {
  const adapter = withLedgerField('coachNotes', [
    { text: 'tampered', kind: 'directive' },
  ]);
  expect(loadState(adapter, 1000)).toBe(null);
});

test('absent report-card fields load as empty arrays', () => {
  const adapter = withLedgerField('coachNotes', []);
  const loaded = loadState(adapter, 1000);
  expect(loaded?.ledger.confidenceHints).toEqual([]);
  expect(loaded?.ledger.rubricProposals).toEqual([]);
});

test('a tampered confidence hint rejects the ledger', () => {
  const adapter = withLedgerField('confidenceHints', [
    { confidence: 'maybe', lastCorrect: true, timestamp: 1 },
  ]);
  expect(loadState(adapter, 1000)).toBe(null);
});

test('a tampered rubric proposal rejects the ledger', () => {
  const adapter = withLedgerField('rubricProposals', [
    { accepted: 'yes', gatePassed: false, timestamp: 1 },
  ]);
  expect(loadState(adapter, 1000)).toBe(null);
});

test('valid report-card records round-trip and clamp at the cap', () => {
  const hints = Array.from({ length: MAX_AGENT_REPORT_RECORDS + 10 }, (_, i) => ({
    confidence: i % 2 === 0 ? 'high' : 'low',
    lastCorrect: i % 3 === 0 ? null : i % 2 === 0,
    timestamp: i,
  }));
  const adapter = withLedgerField('confidenceHints', hints);
  const loaded = loadState(adapter, 1000);
  expect(loaded?.ledger.confidenceHints.length).toBe(MAX_AGENT_REPORT_RECORDS);
  expect(loaded?.ledger.confidenceHints[0]?.timestamp).toBe(10);

  // saveState → loadState round-trip preserves the validated records.
  if (loaded === null || loaded === undefined) {
    return;
  }
  const roundTrip = new MemoryStorageAdapter();
  saveState(roundTrip, loaded);
  expect(loadState(roundTrip, 1000)?.ledger.confidenceHints).toEqual(
    loaded.ledger.confidenceHints,
  );
});
