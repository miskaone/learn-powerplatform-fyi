import { test, expect } from 'bun:test';
import { createEmptyLedger, recordAttempt } from './ledger';
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
  const state: PersistedState = {
    version: 1,
    ledger: recordAttempt(
      createEmptyLedger(),
      gradeAnswer(q1, 'q1-b'),
      42,
    ),
    hints: createHintState(),
  };
  saveState(adapter, state);
  expect(loadState(adapter)).toEqual(state);
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
  adapter.setItem('k', 'v');
  expect(store.get('k')).toBe('v');
  expect(adapter.getItem('k')).toBe('v');
  expect(adapter.isDegraded).toBe(false);
  adapter.removeItem('k');
  expect(store.has('k')).toBe(false);
  expect(adapter.getItem('k')).toBe(null);
  expect(adapter.isDegraded).toBe(false);
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
  };
  saveState(adapter, state);
  expect(adapter.isDegraded).toBe(true);
  expect(loadState(adapter)).toEqual(state);
});
