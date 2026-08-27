import { test, expect } from 'bun:test';
import { validateFlipConditionScenario } from '../rules/flipCondition';
import { MasteryEngine } from './engine';
import {
  FIXTURE_FLIP_SCENARIOS,
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_DRILLS,
} from './fixtures';
import { createEmptyLedger } from './ledger';
import { createHintState } from './hints';
import { MemoryStorageAdapter, loadState, saveState } from './storage';

const UI = 'sample-flip-ui';
const AUTO = 'fixture-flip-automation';

function engine(
  adapter = new MemoryStorageAdapter(),
  now: () => number = () => 1000,
): { engine: MasteryEngine; adapter: MemoryStorageAdapter } {
  return {
    engine: new MasteryEngine(FIXTURE_MANIFEST_WITH_DRILLS, adapter, { now }),
    adapter,
  };
}

test('FIXTURE_FLIP_SCENARIOS both validate against the decision tables', () => {
  expect(FIXTURE_FLIP_SCENARIOS.length).toBe(2);
  for (const scenario of FIXTURE_FLIP_SCENARIOS) {
    expect(validateFlipConditionScenario(scenario)).toEqual([]);
  }
});

test('startDrill with explicit scenarioId starts round 1, phase drill, lists mutatable assumptions', () => {
  const { engine: gate } = engine();
  const started = gate.startDrill(UI);
  expect(started.scenarioId).toBe(UI);
  expect(started.round).toBe(1);
  expect(gate.getLearnerState().phase).toBe('drill');
  expect(started.assumptions).toEqual([
    { id: 'ui-root', text: 'External users?' },
    { id: 'ui-relational', text: 'Relationship-heavy?' },
  ]);
  const session = gate.getActiveDrill();
  expect(session === null).toBe(false);
  if (session === null) {
    return;
  }
  expect(session.round).toBe(1);
  expect(session.usedAssumptionIds).toEqual([]);
  expect(session.currentAssumptionId).toBe(null);
  expect(session.prediction).toBe(null);
});

test('startDrill() auto-selects fewest-completions, falling through to the next scenario', () => {
  let t = 1000;
  const { engine: gate } = engine(new MemoryStorageAdapter(), () => t);
  const first = gate.startDrill();
  expect(first.scenarioId).toBe(UI);

  expect(gate.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(gate.commitPrediction(UI, 'Power Pages', 'external').committed).toBe(
    true,
  );
  t = 1100;
  expect(gate.revealOutcome(UI).sessionComplete).toBe(false);

  expect(gate.mutateAssumption(UI, 'ui-relational').accepted).toBe(true);
  expect(
    gate.commitPrediction(UI, 'Canvas app', 'not relational').committed,
  ).toBe(true);
  t = 1200;
  const last = gate.revealOutcome(UI);
  expect(last.sessionComplete).toBe(true);
  expect(gate.getActiveDrill()).toBe(null);

  const second = gate.startDrill();
  expect(second.scenarioId).toBe(AUTO);
  expect(second.round).toBe(1);
  expect(second.assumptions.map((entry) => entry.id)).toEqual([
    'auto-root',
    'auto-stateless',
  ]);
});

test('startDrill is idempotent for same/omitted scenario and refuses conflicts', () => {
  const unknown = engine();
  expect(() => unknown.engine.startDrill('no-such-scenario')).toThrow(
    'refused: unknown-scenario',
  );

  const { engine: gate } = engine();
  const first = gate.startDrill(UI);
  expect(gate.startDrill()).toEqual(first);
  expect(gate.startDrill(UI)).toEqual(first);
  expect(() => gate.startDrill(AUTO)).toThrow('refused: drill-already-active');
  expect(() => gate.startDrill('no-such-scenario')).toThrow(
    'refused: drill-already-active',
  );

  const empty = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  expect(() => empty.startDrill()).toThrow('refused: no-scenarios');
});

test('mutateAssumption enforces one mutation per round and known assumptions', () => {
  const { engine: gate } = engine();
  const idle = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_DRILLS,
    new MemoryStorageAdapter(),
    { now: () => 1000 },
  );
  expect(idle.mutateAssumption(UI, 'ui-root')).toEqual({
    accepted: false,
    scenarioId: UI,
    round: 0,
    assumptionText: '',
    refusalReason: 'no-active-drill',
  });

  gate.startDrill(UI);
  const ok = gate.mutateAssumption(UI, 'ui-root');
  expect(ok.accepted).toBe(true);
  expect(ok.assumptionText).toBe('External users?');
  expect(ok.round).toBe(1);
  expect(ok.refusalReason).toBe(null);

  const second = gate.mutateAssumption(UI, 'ui-relational');
  expect(second.accepted).toBe(false);
  expect(second.refusalReason).toBe('mutation-already-made-this-round');
  expect(second.assumptionText).toBe('');

  const unknown = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_DRILLS,
    new MemoryStorageAdapter(),
    { now: () => 1000 },
  );
  unknown.startDrill(UI);
  expect(unknown.mutateAssumption(UI, 'not-a-node').refusalReason).toBe(
    'unknown-assumption',
  );
  expect(unknown.mutateAssumption(AUTO, 'ui-root').refusalReason).toBe(
    'scenario-not-active',
  );
});

test('commitPrediction requires mutation, non-empty fields, is irreversible, and clamps to 500', () => {
  const { engine: gate } = engine();
  expect(gate.commitPrediction(UI, 'pages', 'because').refusalReason).toBe(
    'no-active-drill',
  );

  gate.startDrill(UI);
  expect(gate.commitPrediction(UI, 'pages', 'because').refusalReason).toBe(
    'no-mutation-this-round',
  );

  expect(gate.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(gate.commitPrediction(UI, 'pages', '   ').refusalReason).toBe(
    'reason-required',
  );
  expect(gate.commitPrediction(UI, '   ', 'because').refusalReason).toBe(
    'prediction-required',
  );

  const longPrediction = 'P'.repeat(600);
  const longReason = 'R'.repeat(600);
  expect(
    gate.commitPrediction(UI, longPrediction, longReason).committed,
  ).toBe(true);
  const session = gate.getActiveDrill();
  expect(session === null).toBe(false);
  if (session === null || session.prediction === null) {
    throw new Error('expected committed prediction');
  }
  expect(session.prediction.text.length).toBe(500);
  expect(session.prediction.reason.length).toBe(500);

  expect(gate.commitPrediction(UI, 'again', 'nope').refusalReason).toBe(
    'prediction-already-committed',
  );

  const revealed = gate.revealOutcome(UI);
  expect(revealed.record.prediction.length).toBe(500);
  expect(revealed.record.reason.length).toBe(500);
});

test('revealOutcome throws before commit even after a mutation', () => {
  const { engine: gate } = engine();
  gate.startDrill(UI);
  expect(gate.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(() => gate.revealOutcome(UI)).toThrow(
    'refused: prediction-not-committed',
  );
});

test('revealOutcome is deterministic from the decision table for ui-root', () => {
  const correct = engine();
  correct.engine.startDrill(UI);
  expect(correct.engine.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(
    correct.engine.commitPrediction(
      UI,
      'I think Power Pages wins',
      'external users flip the tree',
    ).committed,
  ).toBe(true);
  const hit = correct.engine.revealOutcome(UI);
  expect(hit.outcomeId).toBe('ui-pages');
  expect(hit.outcomeComponent).toBe('Power Pages');
  expect(hit.explanationAnchor).toBe('sample-power-pages');
  expect(hit.predictionWasCorrect).toBe(true);

  const miss = engine();
  miss.engine.startDrill(UI);
  expect(miss.engine.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(
    miss.engine.commitPrediction(UI, 'canvas app', 'wrong guess').committed,
  ).toBe(true);
  const missReveal = miss.engine.revealOutcome(UI);
  expect(missReveal.outcomeId).toBe('ui-pages');
  expect(missReveal.predictionWasCorrect).toBe(false);
});

test('reveal advances the round, completes the session, and records transfer timestamps from now()', () => {
  let t = 9000;
  const { engine: gate } = engine(new MemoryStorageAdapter(), () => t);
  gate.startDrill(UI);

  expect(gate.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(gate.commitPrediction(UI, 'Power Pages', 'external').committed).toBe(
    true,
  );
  const first = gate.revealOutcome(UI);
  expect(first.sessionComplete).toBe(false);
  const afterFirst = gate.getActiveDrill();
  expect(afterFirst === null).toBe(false);
  if (afterFirst === null) {
    return;
  }
  expect(afterFirst.round).toBe(2);
  expect(afterFirst.usedAssumptionIds).toEqual(['ui-root']);
  expect(afterFirst.currentAssumptionId).toBe(null);
  expect(afterFirst.prediction).toBe(null);

  t = 9100;
  expect(gate.mutateAssumption(UI, 'ui-relational').accepted).toBe(true);
  expect(
    gate.commitPrediction(UI, 'Canvas app', 'not relational').committed,
  ).toBe(true);
  const last = gate.revealOutcome(UI);
  expect(last.sessionComplete).toBe(true);
  expect(gate.getActiveDrill()).toBe(null);
  expect(gate.getLearnerState().phase).toBe('practice');

  const records = gate.getDrillResults();
  expect(records.length).toBe(2);
  expect(records[0].dimension).toBe('transfer');
  expect(records[0].timestamp).toBe(9000);
  expect(records[1].dimension).toBe('transfer');
  expect(records[1].timestamp).toBe(9100);
});

test('active drill session and results survive a second MasteryEngine over the same adapter', () => {
  const adapter = new MemoryStorageAdapter();
  const first = new MasteryEngine(FIXTURE_MANIFEST_WITH_DRILLS, adapter, {
    now: () => 3000,
  });
  first.startDrill(UI);
  expect(first.mutateAssumption(UI, 'ui-root').accepted).toBe(true);
  expect(
    first.commitPrediction(UI, 'Power Pages', 'external').committed,
  ).toBe(true);

  const resumed = new MasteryEngine(FIXTURE_MANIFEST_WITH_DRILLS, adapter, {
    now: () => 4000,
  });
  const session = resumed.getActiveDrill();
  expect(session === null).toBe(false);
  if (session === null) {
    return;
  }
  expect(session.scenarioId).toBe(UI);
  expect(session.round).toBe(1);
  expect(session.currentAssumptionId).toBe('ui-root');
  expect(session.prediction).toEqual({
    text: 'Power Pages',
    reason: 'external',
  });

  const revealed = resumed.revealOutcome(UI);
  expect(revealed.outcomeId).toBe('ui-pages');
  expect(revealed.record.timestamp).toBe(4000);
  expect(resumed.getDrillResults()).toEqual([revealed.record]);
});

test('two engines on identical call sequences produce deeply equal drillResults and ledgers', () => {
  function run(): {
    results: ReturnType<MasteryEngine['getDrillResults']>;
    stored: ReturnType<typeof loadState>;
  } {
    let t = 1000;
    const adapter = new MemoryStorageAdapter();
    const gate = new MasteryEngine(FIXTURE_MANIFEST_WITH_DRILLS, adapter, {
      now: () => t,
    });
    gate.startDrill(UI);
    gate.mutateAssumption(UI, 'ui-root');
    gate.commitPrediction(UI, 'Power Pages', 'external');
    gate.revealOutcome(UI);
    t = 2000;
    gate.mutateAssumption(UI, 'ui-relational');
    gate.commitPrediction(UI, 'Canvas app', 'not relational');
    gate.revealOutcome(UI);
    return {
      results: gate.getDrillResults(),
      stored: loadState(adapter),
    };
  }

  const a = run();
  const b = run();
  expect(a.results).toEqual(b.results);
  expect(a.stored).toEqual(b.stored);
});

test('endDrill clears the session and restores phase', () => {
  const { engine: gate } = engine();
  gate.endDrill();
  expect(gate.getActiveDrill()).toBe(null);
  expect(gate.getLearnerState().phase).toBe('lesson');

  gate.startDrill(UI);
  expect(gate.getLearnerState().phase).toBe('drill');
  gate.endDrill();
  expect(gate.getActiveDrill()).toBe(null);
  expect(gate.getLearnerState().phase).toBe('practice');
});

test('startDrill throws when an unsubmitted exam is on the ledger', () => {
  const adapter = new MemoryStorageAdapter();
  const ledger = createEmptyLedger();
  ledger.exam = {
    startedAt: 1,
    durationSeconds: 60,
    questionIds: ['q1'],
    answers: {},
    submitted: false,
    submittedAt: null,
    verdicts: [],
  };
  saveState(adapter, {
    version: 1,
    ledger,
    hints: createHintState(),
    lastGrade: null,
  });
  const gate = new MasteryEngine(FIXTURE_MANIFEST_WITH_DRILLS, adapter, {
    now: () => 1000,
  });
  expect(() => gate.startDrill()).toThrow('refused: exam-active');
});
