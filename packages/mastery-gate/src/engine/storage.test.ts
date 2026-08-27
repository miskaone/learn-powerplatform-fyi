import { test, expect } from 'bun:test';
import {
  createEmptyLedger,
  MAX_LEARNER_NAME_LENGTH,
  recordAttempt,
} from './ledger';
import { createHintState } from './hints';
import { gradeAnswer } from './grading';
import { fixtureQuestion } from './fixtures';
import {
  LocalStorageAdapter,
  MemoryStorageAdapter,
  STORAGE_KEY,
  loadState,
  saveState,
} from './storage';
import type { LocalStorageLike, PersistedState } from './storage';
import type { DrillResultRecord, DrillSessionState, Ledger } from '../schema';

test('MemoryStorageAdapter get/set/remove semantics', () => {
  const adapter = new MemoryStorageAdapter();
  expect(adapter.getItem('missing')).toBe(null);
  adapter.setItem('k', 'v');
  expect(adapter.getItem('k')).toBe('v');
  adapter.setItem('k', 'v2');
  expect(adapter.getItem('k')).toBe('v2');
  adapter.removeItem('k');
  expect(adapter.getItem('k')).toBe(null);
  adapter.removeItem('k');
  expect(adapter.getItem('k')).toBe(null);
});

test('save/load roundtrip is deep-equal', () => {
  const adapter = new MemoryStorageAdapter();
  const q1 = fixtureQuestion('q1');
  const grade = gradeAnswer(q1, 'q1-b');
  const state: PersistedState = {
    version: 1,
    ledger: recordAttempt(createEmptyLedger(), grade, 42),
    hints: createHintState(),
    lastGrade: grade,
  };
  saveState(adapter, state);
  expect(loadState(adapter)).toEqual(state);
});

test('legacy payload without lastGrade loads with lastGrade null', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      ledger: createEmptyLedger(),
      hints: createHintState(),
    }),
  );
  const loaded = loadState(adapter);
  expect(loaded === null).toBe(false);
  expect(loaded?.lastGrade).toBe(null);
});

test('version-1 record with a wrong-shaped ledger returns null instead of crashing later', () => {
  // Cross-review MAJOR (2026-08-27): {"version":1,"ledger":{},"hints":{}}
  // previously type-asserted through and crashed getCurrentQuestion.
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, ledger: {}, hints: {} }),
  );
  expect(loadState(adapter)).toBe(null);
});

test('ledger field-by-field validation rejects malformed payloads', () => {
  const good = (): Record<string, unknown> => ({
    version: 1,
    ledger: createEmptyLedger(),
    hints: createHintState(),
    lastGrade: null,
  });
  const mutate = (fn: (s: Record<string, unknown>) => void) => {
    const s = good();
    fn(s);
    return s;
  };
  const cases: Array<Record<string, unknown>> = [
    mutate((s) => {
      (s.ledger as { scores: Record<string, unknown> }).scores.recall = 9;
    }),
    mutate((s) => {
      (s.ledger as { scores: Record<string, unknown> }).scores.transfer =
        'four';
    }),
    mutate((s) => {
      (s.ledger as Record<string, unknown>).attempts = [{ questionId: 42 }];
    }),
    mutate((s) => {
      (s.ledger as Record<string, unknown>).phase = 'bogus';
    }),
    mutate((s) => {
      (s.ledger as Record<string, unknown>).coachNotes = [1, 2];
    }),
    mutate((s) => {
      s.hints = { tiersIssued: { q1: 'two' } };
    }),
    mutate((s) => {
      s.lastGrade = { questionId: 'q1' };
    }),
  ];
  for (const payload of cases) {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem(STORAGE_KEY, JSON.stringify(payload));
    expect(loadState(adapter)).toBe(null);
  }
});

test('corrupt JSON returns null', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(STORAGE_KEY, '{not-json');
  expect(loadState(adapter)).toBe(null);
});

test('version 2 payload returns null', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      ledger: createEmptyLedger(),
      hints: createHintState(),
    }),
  );
  expect(loadState(adapter)).toBe(null);
});

test('missing key returns null', () => {
  expect(loadState(new MemoryStorageAdapter())).toBe(null);
});

test('loadState never throws on garbage payloads', () => {
  const garbage = ['{', '[]', 'null', '"x"'];
  for (const payload of garbage) {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem(STORAGE_KEY, payload);
    let threw = false;
    let result: unknown = 'sentinel';
    try {
      result = loadState(adapter);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBe(null);
  }
});

function createMapBacking(): {
  backing: LocalStorageLike;
  store: Map<string, string>;
  counts: { get: number; set: number; remove: number };
} {
  const store = new Map<string, string>();
  const counts = { get: 0, set: 0, remove: 0 };
  const backing: LocalStorageLike = {
    getItem(key: string): string | null {
      counts.get += 1;
      if (!store.has(key)) {
        return null;
      }
      return store.get(key) as string;
    },
    setItem(key: string, value: string): void {
      counts.set += 1;
      store.set(key, value);
    },
    removeItem(key: string): void {
      counts.remove += 1;
      store.delete(key);
    },
  };
  return { backing, store, counts };
}

test('LocalStorageAdapter round-trips through a Map-backed stub', () => {
  const { backing, store } = createMapBacking();
  const adapter = new LocalStorageAdapter(backing);
  expect(store.has('mastery-gate:probe')).toBe(false);
  adapter.setItem('k', 'v');
  expect(store.get('k')).toBe('v');
  expect(adapter.getItem('k')).toBe('v');
  expect(adapter.isDegraded).toBe(false);
  adapter.removeItem('k');
  expect(store.has('k')).toBe(false);
  expect(adapter.getItem('k')).toBe(null);
  expect(adapter.isDegraded).toBe(false);
});

test('LocalStorageAdapter constructor probe degrades immediately and still round-trips in memory', () => {
  const backing: LocalStorageLike = {
    getItem(_key: string): string | null {
      return null;
    },
    setItem(_key: string, _value: string): void {
      throw new Error('QuotaExceededError');
    },
    removeItem(_key: string): void {
      return;
    },
  };
  const adapter = new LocalStorageAdapter(backing);
  expect(adapter.isDegraded).toBe(true);
  adapter.setItem('k', 'kept');
  expect(adapter.getItem('k')).toBe('kept');
});

test('LocalStorageAdapter degrades on quota throw and never touches the stub again', () => {
  const counts = { get: 0, set: 0, remove: 0 };
  const backing: LocalStorageLike = {
    getItem(_key: string): string | null {
      counts.get += 1;
      return null;
    },
    setItem(_key: string, _value: string): void {
      counts.set += 1;
      throw new Error('QuotaExceededError');
    },
    removeItem(_key: string): void {
      counts.remove += 1;
    },
  };
  const adapter = new LocalStorageAdapter(backing);
  adapter.setItem('k', 'kept');
  expect(adapter.isDegraded).toBe(true);
  expect(adapter.getItem('k')).toBe('kept');
  const afterDegrade = { ...counts };
  adapter.getItem('k');
  adapter.setItem('k2', 'later');
  adapter.removeItem('k');
  expect(counts.get).toBe(afterDegrade.get);
  expect(counts.set).toBe(afterDegrade.set);
  expect(counts.remove).toBe(afterDegrade.remove);
  expect(adapter.getItem('k2')).toBe('later');
  expect(adapter.getItem('k')).toBe(null);
});

test('LocalStorageAdapter with backing null uses memory mode', () => {
  const adapter = new LocalStorageAdapter(null);
  adapter.setItem('k', 'v');
  expect(adapter.getItem('k')).toBe('v');
  adapter.removeItem('k');
  expect(adapter.getItem('k')).toBe(null);
});

test('LocalStorageAdapter with no backing argument uses memory mode without throwing', () => {
  const adapter = new LocalStorageAdapter();
  adapter.setItem('k', 'v');
  expect(adapter.getItem('k')).toBe('v');
  adapter.removeItem('k');
  expect(adapter.getItem('k')).toBe(null);
});

function oldFormatLedger(): Record<string, unknown> {
  return {
    attempts: [],
    misconceptionFires: {},
    scores: {
      recall: 0,
      connections: 0,
      application: 0,
      transfer: 0,
    },
    coachNotes: [],
    phase: 'lesson',
  };
}

test('old-format persisted state without the five new ledger fields loads with defaults', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      ledger: oldFormatLedger(),
      hints: createHintState(),
    }),
  );
  const loaded = loadState(adapter);
  expect(loaded === null).toBe(false);
  if (loaded === null) {
    return;
  }
  expect(loaded.ledger.drillResults).toEqual([]);
  expect(loaded.ledger.activeDrill).toBe(null);
  expect(loaded.ledger.exam).toBe(null);
  expect(loaded.ledger.debrief).toBe(null);
  expect(loaded.ledger.learnerName).toBe(null);
});

test('tampered activeDrill or drillResults dimension rejects the whole state', () => {
  const good = (): Record<string, unknown> => ({
    version: 1,
    ledger: createEmptyLedger(),
    hints: createHintState(),
    lastGrade: null,
  });

  const badRound = good();
  (badRound.ledger as { activeDrill: unknown }).activeDrill = {
    scenarioId: 'sample-flip-ui',
    round: 'x',
    usedAssumptionIds: [],
    currentAssumptionId: null,
    prediction: null,
  };
  const roundAdapter = new MemoryStorageAdapter();
  roundAdapter.setItem(STORAGE_KEY, JSON.stringify(badRound));
  expect(loadState(roundAdapter)).toBe(null);

  const badDimension = good();
  (badDimension.ledger as { drillResults: unknown[] }).drillResults = [
    {
      scenarioId: 'sample-flip-ui',
      assumptionId: 'ui-root',
      prediction: 'Power Pages',
      reason: 'external',
      outcomeId: 'ui-pages',
      outcomeComponent: 'Power Pages',
      predictionWasCorrect: true,
      dimension: 'recall',
      timestamp: 1,
    },
  ];
  const dimensionAdapter = new MemoryStorageAdapter();
  dimensionAdapter.setItem(STORAGE_KEY, JSON.stringify(badDimension));
  expect(loadState(dimensionAdapter)).toBe(null);
});

test('learnerName longer than 40 chars is clamped on load, not rejected', () => {
  const adapter = new MemoryStorageAdapter();
  const ledger = createEmptyLedger();
  ledger.learnerName = 'N'.repeat(MAX_LEARNER_NAME_LENGTH + 12);
  adapter.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      ledger,
      hints: createHintState(),
      lastGrade: null,
    }),
  );
  const loaded = loadState(adapter);
  expect(loaded === null).toBe(false);
  expect(loaded?.ledger.learnerName).toBe('N'.repeat(MAX_LEARNER_NAME_LENGTH));
});

test('full round-trip of drillResults, activeDrill, and learnerName is deep-equal after clamping', () => {
  const adapter = new MemoryStorageAdapter();
  const record: DrillResultRecord = {
    scenarioId: 'sample-flip-ui',
    assumptionId: 'ui-root',
    prediction: 'Power Pages',
    reason: 'external users',
    outcomeId: 'ui-pages',
    outcomeComponent: 'Power Pages',
    predictionWasCorrect: true,
    dimension: 'transfer',
    timestamp: 42,
  };
  const session: DrillSessionState = {
    scenarioId: 'sample-flip-ui',
    round: 1,
    usedAssumptionIds: [],
    currentAssumptionId: 'ui-root',
    prediction: { text: 'Power Pages', reason: 'external users' },
  };
  const ledger: Ledger = createEmptyLedger();
  ledger.drillResults = [record];
  ledger.activeDrill = session;
  ledger.learnerName = 'Ada Lovelace';
  const state: PersistedState = {
    version: 1,
    ledger,
    hints: createHintState(),
    lastGrade: null,
  };
  saveState(adapter, state);
  expect(loadState(adapter)).toEqual(state);
});

test('saveState/loadState round-trip through a throwing-then-degraded LocalStorageAdapter', () => {
  const backing: LocalStorageLike = {
    getItem(_key: string): string | null {
      throw new Error('security');
    },
    setItem(_key: string, _value: string): void {
      throw new Error('QuotaExceededError');
    },
    removeItem(_key: string): void {
      throw new Error('security');
    },
  };
  const adapter = new LocalStorageAdapter(backing);
  const q1 = fixtureQuestion('q1');
  const state: PersistedState = {
    version: 1,
    ledger: recordAttempt(createEmptyLedger(), gradeAnswer(q1, 'q1-b'), 42),
    hints: createHintState(),
    lastGrade: null,
  };
  saveState(adapter, state);
  expect(adapter.isDegraded).toBe(true);
  expect(loadState(adapter)).toEqual(state);
});
