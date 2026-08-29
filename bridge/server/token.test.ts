import { expect, test } from 'bun:test';
import { generateToken, tokenMatches } from './token';

test('generateToken returns 64 hex chars', () => {
  const token = generateToken();
  expect(token).toHaveLength(64);
  expect(/^[0-9a-f]+$/.test(token)).toBe(true);
});

test('generateToken returns different values on two calls', () => {
  expect(generateToken()).not.toBe(generateToken());
});

test('tokenMatches is true for exact match', () => {
  const token = generateToken();
  expect(tokenMatches(token, token)).toBe(true);
});

test('tokenMatches is false for a different token', () => {
  const a = generateToken();
  const b = generateToken();
  expect(tokenMatches(a, b)).toBe(false);
});

test('tokenMatches is false for different lengths', () => {
  expect(tokenMatches('abc', 'ab')).toBe(false);
});

test('tokenMatches never throws on empty strings', () => {
  expect(tokenMatches('', '')).toBe(true);
  expect(tokenMatches('', 'x')).toBe(false);
  expect(tokenMatches('x', '')).toBe(false);
});
