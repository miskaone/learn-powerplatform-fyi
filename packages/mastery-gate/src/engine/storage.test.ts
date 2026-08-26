import { test, expect } from 'bun:test';
import { createEmptyLedger, recordAttempt } from './ledger';
import { createHintState } from './hints';
import { gradeAnswer } from './grading';
import { fixtureQuestion } from './fixtures';
import {
  MemoryStorageAdapter,
  STORAGE_KEY,
  loadState,
  saveState,
} from './storage';
import type { PersistedState } from './storage';

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
