import type { RubricScore, RubricScores } from '../schema';
import { RUBRIC_DIMENSIONS } from './rubric';

export interface RubricValidationOk {
  ok: true;
  scores: RubricScores;
}

export interface RubricValidationError {
  ok: false;
  errors: string[];
}

export type RubricValidationResult = RubricValidationOk | RubricValidationError;

export function validateRubricSubmission(
  input: unknown,
  corpus?: string,
): RubricValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ['submission is not an object'] };
  }

  const errors: string[] = [];
  const scores: Partial<RubricScores> = {};

  for (const dimension of RUBRIC_DIMENSIONS) {
    const block = input[dimension];
    if (!isRecord(block)) {
      errors.push(`${dimension}: missing or not an object`);
      continue;
    }

    const quote = block.quote;
    if (typeof quote !== 'string' || quote.trim() === '') {
      errors.push(
        `${dimension}: quote is missing, not a string, or empty`,
      );
    } else if (corpus !== undefined && !corpus.includes(quote)) {
      errors.push(
        `${dimension}: quote is not verbatim from the session transcript`,
      );
    }

    const score = block.score;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      errors.push(`${dimension}: score is missing or not a finite number`);
    } else {
      scores[dimension] = clampRubricScore(score);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    scores: {
      recall: scores.recall as RubricScore,
      connections: scores.connections as RubricScore,
      application: scores.application as RubricScore,
      transfer: scores.transfer as RubricScore,
    },
  };
}

function clampRubricScore(score: number): RubricScore {
  const clamped = Math.min(4, Math.max(0, Math.round(score)));
  return clamped as RubricScore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
