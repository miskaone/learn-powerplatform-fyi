import { test, expect } from 'bun:test';
import type { RubricDimension, RubricScores } from '../schema';
import { GATE_THRESHOLD, RUBRIC_DIMENSIONS, gatePasses } from './rubric';

function scores(
  recall: RubricScores['recall'],
  connections: RubricScores['connections'],
  application: RubricScores['application'],
  transfer: RubricScores['transfer'],
): RubricScores {
  return { recall, connections, application, transfer };
}

test('gate passes when every dimension is 3', () => {
  expect(gatePasses(scores(3, 3, 3, 3))).toBe(true);
  expect(GATE_THRESHOLD).toBe(3);
});

test('gate passes when every dimension is 4', () => {
  expect(gatePasses(scores(4, 4, 4, 4))).toBe(true);
});

test('gate refuses the named 3/3/3/2 case', () => {
  expect(gatePasses(scores(3, 3, 3, 2))).toBe(false);
});

test('gate refuses each single dimension at 2 while others are 4', () => {
  const variants: RubricScores[] = [
    scores(2, 4, 4, 4),
    scores(4, 2, 4, 4),
    scores(4, 4, 2, 4),
    scores(4, 4, 4, 2),
  ];
  expect(variants.length).toBe(RUBRIC_DIMENSIONS.length);
  for (const variant of variants) {
    expect(gatePasses(variant)).toBe(false);
  }
});

test('gate refuses 0/0/0/0', () => {
  expect(gatePasses(scores(0, 0, 0, 0))).toBe(false);
});

test('RUBRIC_DIMENSIONS lists recall, connections, application, transfer', () => {
  const expected: readonly RubricDimension[] = [
    'recall',
    'connections',
    'application',
    'transfer',
  ];
  expect(RUBRIC_DIMENSIONS).toEqual(expected);
});
