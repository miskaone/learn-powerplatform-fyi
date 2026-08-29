import { expect, test } from 'bun:test';
import { nextBackoffMs } from './backoff.js';

test('attempt 0 with rand:()=>0 returns base', () => {
  expect(nextBackoffMs(0, { rand: () => 0 })).toBe(500);
});

test('grows 2^n', () => {
  expect(nextBackoffMs(1, { rand: () => 0 })).toBe(1000);
  expect(nextBackoffMs(2, { rand: () => 0 })).toBe(2000);
  expect(nextBackoffMs(3, { rand: () => 0 })).toBe(4000);
});

test('clamps at max', () => {
  expect(nextBackoffMs(20, { rand: () => 0 })).toBe(15_000);
  expect(nextBackoffMs(8, { base: 500, max: 1000, rand: () => 0 })).toBe(1000);
});

test('jitter added when rand:()=>1 is ≈ jitterMs', () => {
  const value = nextBackoffMs(0, { rand: () => 1 });
  expect(value).toBeGreaterThanOrEqual(500);
  expect(value).toBeLessThan(500 + 250 + 1);
  expect(value).toBeCloseTo(500 + 250, 5);
});

test('negative and NaN attempt treated as 0 (base)', () => {
  expect(nextBackoffMs(-1, { rand: () => 0 })).toBe(500);
  expect(nextBackoffMs(Number.NaN, { rand: () => 0 })).toBe(500);
  expect(nextBackoffMs(Number.POSITIVE_INFINITY, { rand: () => 0 })).toBe(500);
});
