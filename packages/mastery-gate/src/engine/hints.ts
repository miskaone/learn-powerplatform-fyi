import type { Ledger, Misconception, Question } from '../schema';
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
    }
  | {
      granted: false;
      questionId: string;
      reason: 'tier2-requires-attempt' | 'ladder-exhausted' | 'exam-active';
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
  misconceptions: readonly Misconception[],
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

    const guidance = contrastGuidance(ledger, question, misconceptions);
    return {
      state: grantTier(state, question.id, 2),
      result: {
        granted: true,
        tier: 2,
        questionId: question.id,
        guidance,
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

function contrastGuidance(
  ledger: Ledger,
  question: Question,
  misconceptions: readonly Misconception[],
): string {
  const fallback = `Contrast the options against: ${question.concepts.join(', ')}. Restate the concept in your own words before choosing again.`;

  let lastIncorrectOptionId: string | null = null;
  for (let i = ledger.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = ledger.attempts[i];
    if (attempt.questionId === question.id && !attempt.correct) {
      lastIncorrectOptionId = attempt.optionId;
      break;
    }
  }
  if (lastIncorrectOptionId === null) {
    return fallback;
  }

  let misconceptionId: string | undefined;
  for (const option of question.options) {
    if (option.id === lastIncorrectOptionId) {
      misconceptionId = option.misconceptionId;
      break;
    }
  }
  if (misconceptionId === undefined) {
    return fallback;
  }

  for (const misconception of misconceptions) {
    if (misconception.id === misconceptionId) {
      return `Your previous answer reflects "${misconception.name}". ${misconception.contrast}`;
    }
  }
  return fallback;
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
