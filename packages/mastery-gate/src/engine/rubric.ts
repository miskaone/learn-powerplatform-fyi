import type { RubricDimension, RubricScores } from '../schema';

export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  'recall',
  'connections',
  'application',
  'transfer',
];

export const GATE_THRESHOLD = 3;

export function gatePasses(scores: RubricScores): boolean {
  return (
    scores.recall >= GATE_THRESHOLD &&
    scores.connections >= GATE_THRESHOLD &&
    scores.application >= GATE_THRESHOLD &&
    scores.transfer >= GATE_THRESHOLD
  );
}
