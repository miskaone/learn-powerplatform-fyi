export type { GradeResult } from './grading';
export { gradeAnswer } from './grading';

export {
  createEmptyLedger,
  recordAttempt,
  attemptCount,
  missCount,
  misconceptionFireCount,
  isRepeatedMisconception,
} from './ledger';

export { RUBRIC_DIMENSIONS, GATE_THRESHOLD, gatePasses } from './rubric';

export type { RoutingVerdict, RoutingInput } from './routing';
export { routeNextAction } from './routing';

export type { HintState, HintResult } from './hints';
export { createHintState, requestHint } from './hints';

export type {
  RubricValidationOk,
  RubricValidationError,
  RubricValidationResult,
} from './rubricEvidence';
export { validateRubricSubmission } from './rubricEvidence';

export type { PersistedState } from './storage';
export {
  STORAGE_KEY,
  MemoryStorageAdapter,
  saveState,
  loadState,
} from './storage';

export type {
  LearnerStatePublic,
  SubmitAnswerResult,
  MasteryEngineOptions,
} from './engine';
export { MasteryEngine } from './engine';
