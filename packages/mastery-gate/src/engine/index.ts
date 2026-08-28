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
  clampAgentReportRecords,
  clampLessonTextRecord,
  MAX_COACH_NOTES,
  MAX_COACH_NOTE_LENGTH,
  MAX_AGENT_REPORT_RECORDS,
  MAX_LEARNER_NAME_LENGTH,
  MAX_LESSON_AIM_LENGTH,
  MAX_RULE_COMPRESSION_LENGTH,
  MAX_RUN_COMMITMENT_LENGTH,
  MAX_LESSON_TEXT_ENTRIES,
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
  LessonTextResult,
  SubmitAnswerResult,
  MasteryEngineOptions,
  CoachingNoteResult,
  CoachCalibrationSummary,
} from './engine';
export {
  MasteryEngine,
  MAX_ATTEMPTS_PER_QUESTION,
  RUBRIC_INTERVIEW_MIN_COVERAGE,
  ANSWER_TEXT_WINDOW,
} from './engine';

export type { ExamStatus, ExamDebrief } from './exam';
export {
  DEFAULT_EXAM_DURATION_SECONDS,
  MIN_EXAM_DURATION_SECONDS,
  MAX_EXAM_DURATION_SECONDS,
} from './exam';

export type { ComposeDebriefResult } from './debrief';
export { MAX_DEBRIEF_SEGMENTS } from './debrief';

export {
  COVERAGE_MANIFEST,
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_DRILLS,
  FIXTURE_MANIFEST_WITH_EXAM,
  FIXTURE_FLIP_SCENARIOS,
} from './fixtures';
