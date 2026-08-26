import type { Ledger, Question } from '../schema';
import { attemptCount } from './ledger';

export interface HintState {
  tiersIssued: Record<string, number>;
}

export type HintResult =
  | {
      granted: true;
      tier: 1 | 2;
      questionId: string;
      guidance: string;
      eliminatedOptionId?: string;
    }
  | {
      granted: false;
      questionId: string;
      reason: 'tier2-requires-attempt' | 'ladder-exhausted';
    };

export function createHintState(): HintState {
  return {
    tiersIssued: {},
  };
}

export function requestHint(
  state: HintState,
  ledger: Ledger,
  question: Question,
): { state: HintState; result: HintResult } {
  const nextTier = (state.tiersIssued[question.id] ?? 0) + 1;

  if (nextTier === 1) {
    const guidance = `Focus on: ${question.concepts.join(', ')}. Re-read the section this question cites.`;
    return {
      state: grantTier(state, question.id, 1),
      result: {
        granted: true,
        tier: 1,
        questionId: question.id,
        guidance,
      },
    };
  }

  if (nextTier === 2) {
    if (attemptCount(ledger, question.id) < 1) {
      return {
        state,
        result: {
          granted: false,
          questionId: question.id,
          reason: 'tier2-requires-attempt',
        },
      };
    }

    const eliminated = question.options.find(
      (option) => option.id !== question.correctOptionId,
    );
    const eliminatedOptionId = eliminated ? eliminated.id : '';
    const guidance = `You can safely eliminate option ${eliminatedOptionId}.`;
    return {
      state: grantTier(state, question.id, 2),
      result: {
        granted: true,
        tier: 2,
        questionId: question.id,
        guidance,
        eliminatedOptionId,
      },
    };
  }

  return {
    state,
    result: {
      granted: false,
      questionId: question.id,
      reason: 'ladder-exhausted',
    },
  };
}

function grantTier(
  state: HintState,
  questionId: string,
  tier: number,
): HintState {
  const tiersIssued: Record<string, number> = {};
  for (const key of Object.keys(state.tiersIssued)) {
    tiersIssued[key] = state.tiersIssued[key];
  }
  tiersIssued[questionId] = tier;
  return { tiersIssued };
}
