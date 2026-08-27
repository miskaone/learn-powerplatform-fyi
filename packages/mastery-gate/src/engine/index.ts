export type { GradeResult } from './grading';
export { gradeAnswer } from './grading';

export {
  createEmptyLedger,
  cloneLedger,
  recordAttempt,
  attemptCount,
  missCount,
  misconceptionFireCount,
  isRepeatedMisconception,
  clampCoachNotes,
  MAX_COACH_NOTES,
  MAX_COACH_NOTE_LENGTH,
  MAX_LEARNER_NAME_LENGTH,
} from './ledger';

export type {
  DrillAssumptionPublic,
  StartDrillResult,
  MutateResult,
  CommitResult,
  RevealResult,
} from './drill';
export {
  MAX_PREDICTION_LENGTH,
  MAX_PREDICTION_REASON_LENGTH,
} from './drill';

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

export type { PersistedState, LocalStorageLike } from './storage';
export {
  STORAGE_KEY,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  saveState,
  loadState,
} from './storage';

export type {
  LearnerStatePublic,
  SubmitAnswerResult,
  MasteryEngineOptions,
} from './engine';
export { MasteryEngine, MAX_ATTEMPTS_PER_QUESTION } from './engine';

export type { ExamStatus, ExamDebrief } from './exam';
export {
  DEFAULT_EXAM_DURATION_SECONDS,
  MIN_EXAM_DURATION_SECONDS,
  MAX_EXAM_DURATION_SECONDS,
} from './exam';

export type { ComposeDebriefResult } from './debrief';
export { MAX_DEBRIEF_SEGMENTS } from './debrief';

export {
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_DRILLS,
  FIXTURE_MANIFEST_WITH_EXAM,
  FIXTURE_FLIP_SCENARIOS,
} from './fixtures';
