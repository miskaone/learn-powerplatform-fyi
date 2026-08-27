import type {
  DebriefSegment,
  Misconception,
  NarrationCue,
  NextAction,
  QuestionPublic,
  RubricDimension,
  RubricScore,
  RubricScores,
  ToolPhase,
} from '../schema';

/** Redacted learner snapshot. Structurally lacks any averaged mastery field. */
export interface LearnerStatePublic {
  scores: RubricScores;
  misconceptionFires: Record<string, number>;
  phase: ToolPhase;
  gatePassed: boolean;
  attemptCount: number;
}

export interface CurrentContextPublic {
  objectiveId: string;
  sectionId: string;
  sectionTitle: string;
  concepts: string[];
  prerequisites: string[];
}

export interface SubmitAnswerVerdictPublic {
  questionId: string;
  correct: boolean;
  misconceptionId: string | null;
  attemptNumber: number;
  attemptsRemaining: number;
}

export interface HintResultPublic {
  granted: boolean;
  tier: 1 | 2 | null;
  hint: string | null;
  refusal: string | null;
}

export type DrillKind = 'spaced_review' | 'feynman' | 'failure_case' | 'what_if';

export interface DrillPrescriptionPublic {
  drillKind: DrillKind;
  targetDimension: RubricDimension;
  rationale: string;
}

export interface RubricEvidence {
  score: RubricScore;
  evidenceQuote: string;
}

export type RubricSubmission = Record<RubricDimension, RubricEvidence>;

export interface RubricVerdictPublic {
  accepted: boolean;
  scores: RubricScores;
  gatePassed: boolean;
  rejectionReason: string | null;
}

export interface NavigateResultPublic {
  ok: boolean;
  anchor: string;
}

export interface MutateAssumptionResultPublic {
  accepted: boolean;
  scenarioId: string;
  round: number;
  assumptionText: string;
}

export interface CommitPredictionResultPublic {
  committed: boolean;
  scenarioId: string;
}

export interface RevealOutcomeResultPublic {
  outcome: string;
  predictionWasCorrect: boolean;
  explanationAnchor: string;
}

export interface ExamStatusPublic {
  active: boolean;
  remainingSeconds: number;
  questionsAnswered: number;
  questionsTotal: number;
  submitted: boolean;
}

export interface ExamDebriefPublic {
  scores: RubricScores;
  missedConceptIds: string[];
  misconceptionIdsFired: string[];
}

export interface AdvanceModuleResultPublic {
  advanced: boolean;
  nextObjectiveId: string | null;
}

export interface ComposeDebriefResultPublic {
  accepted: boolean;
  rejectedSegmentIds: string[];
  reason: string | null;
}

export interface AdvanceSegmentResultPublic {
  ok: boolean;
  currentSegmentId: string | null;
}

export interface RegistrySnapshot {
  phase: ToolPhase;
  gatePassed: boolean;
  repeatedMisconceptionIds: string[];
  predictionCommitted: boolean;
  examSubmitted: boolean;
  moduleComplete: boolean;
}

/**
 * Public engine interface the WebMCP tools delegate through.
 * Implementations must not expose answer-key or distractor-map fields.
 */
export interface EngineFacade {
  getLearnerState(): LearnerStatePublic;
  getCurrentContext(): CurrentContextPublic;
  getCurrentQuestion(): QuestionPublic | null;
  submitAnswer(questionId: string, optionId: string): SubmitAnswerVerdictPublic;
  getHint(questionId: string): HintResultPublic;
  /**
   * Engine routing verdict. `'continue'` covers correct+confident / no-attempt
   * states the five-row routing table does not define (matches the engine's
   * RoutingVerdict union). `confidence: 'low'` after a correct answer routes
   * to `go_deeper` (routing table row 4).
   */
  requestNextAction(confidence?: 'low' | 'high'): NextAction | 'continue';
  prescribeDrill(): DrillPrescriptionPublic;
  scoreRubric(submission: RubricSubmission): RubricVerdictPublic;
  logCoachingNote(note: string): void;
  navigateToAnchor(anchor: string): NavigateResultPublic;
  getMisconceptionBrief(misconceptionId: string): Misconception | null;
  mutateAssumption(
    scenarioId: string,
    assumptionId: string,
  ): MutateAssumptionResultPublic;
  commitPrediction(
    scenarioId: string,
    prediction: string,
    reason: string,
  ): CommitPredictionResultPublic;
  revealOutcome(scenarioId: string): RevealOutcomeResultPublic;
  startExam(): ExamStatusPublic;
  getExamStatus(): ExamStatusPublic;
  submitExam(): ExamStatusPublic;
  getExamDebrief(): ExamDebriefPublic;
  advanceModule(): AdvanceModuleResultPublic;
  getFiredMisconceptionIds(): string[];
  composeDebrief(segments: DebriefSegment[]): ComposeDebriefResultPublic;
  getNarrationScript(): NarrationCue[];
  advanceSegment(segmentId: string): AdvanceSegmentResultPublic;
  /** Registry sync input derived from real engine state — the single source for dynamic tool registration. */
  getRegistrySnapshot(): RegistrySnapshot;
}
