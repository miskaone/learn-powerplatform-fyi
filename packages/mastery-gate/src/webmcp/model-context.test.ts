import { test, expect } from 'bun:test';
import { MockModelContext } from './mock-model-context';
import {
  hasModelContext,
  resolveModelContext,
  textResponse,
} from './model-context';

test('resolveModelContext prefers navigator.modelContext when both namespaces exist', () => {
  const navigatorContext = new MockModelContext();
  const documentContext = new MockModelContext();
  const host = {
    navigator: { modelContext: navigatorContext },
    document: { modelContext: documentContext },
  };
  expect(resolveModelContext(host)).toBe(navigatorContext);
  expect(hasModelContext(host)).toBe(true);
});

test('resolveModelContext returns document.modelContext when only that namespace exists', () => {
  const documentContext = new MockModelContext();
  const host = {
    document: { modelContext: documentContext },
  };
  expect(resolveModelContext(host)).toBe(documentContext);
  expect(hasModelContext(host)).toBe(true);
});

test('resolveModelContext returns null when neither namespace exists', () => {
  expect(resolveModelContext({ navigator: {}, document: {} })).toBe(null);
  expect(hasModelContext({ navigator: {}, document: {} })).toBe(false);
});

test('resolveModelContext returns null for an empty host', () => {
  expect(resolveModelContext({})).toBe(null);
  expect(hasModelContext({})).toBe(false);
});

test('resolveModelContext returns null when navigator exists but has no modelContext', () => {
  expect(resolveModelContext({ navigator: {} })).toBe(null);
  expect(hasModelContext({ navigator: {} })).toBe(false);
});

test('textResponse wraps payload as a single text content block', () => {
  const payload = { id: 'q-1', nested: { flags: [true, false] } };
  const response = textResponse(payload);
  expect(response.content[0].type).toBe('text');
  expect(JSON.parse(response.content[0].text)).toEqual(payload);
});
