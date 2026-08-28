import type { Ledger, NextAction } from '../schema';
import type { GradeResult } from './grading';
import {
  isRepeatedMisconception,
  missCount,
} from './ledger';
import { gatePasses } from './rubric';

export type RoutingVerdict = NextAction | 'continue' | 'rubric_interview';

export interface RoutingInput {
  ledger: Ledger;
  lastGrade: GradeResult | null;
  confidence?: 'low' | 'high';
  rubricInterviewReady?: boolean;
}

/**
 * Precedence, exactly this order:
 * 1. gatePasses(ledger.scores) → 'advance'
 * 2. last grade is a miss AND its misconceptionId has fired >= 2 times in the ledger → 'coach'
 * 3. last grade is a miss AND missCount(ledger, questionId) === 1 (first miss on that question) → 'hint'
 * 4. last grade is a miss (second or later miss on that question) → 'review'
 * 5. last grade correct AND confidence === 'low' → 'go_deeper'
 * 6. rubricInterviewReady === true → 'rubric_interview'
 * 7. otherwise → 'continue' (correct + confident, gate not yet passed; or no attempt yet)
 */
export function routeNextAction(input: RoutingInput): RoutingVerdict {
  const { ledger, lastGrade, confidence, rubricInterviewReady } = input;

  if (gatePasses(ledger.scores)) {
    return 'advance';
  }

  if (lastGrade !== null && !lastGrade.correct) {
    if (
      lastGrade.misconceptionId !== null &&
      isRepeatedMisconception(ledger, lastGrade.misconceptionId)
    ) {
      return 'coach';
    }

    if (missCount(ledger, lastGrade.questionId) === 1) {
      return 'hint';
    }

    return 'review';
  }

  if (lastGrade !== null && lastGrade.correct && confidence === 'low') {
    return 'go_deeper';
  }

  if (rubricInterviewReady === true) {
    return 'rubric_interview';
  }

  return 'continue';
}
