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
  lessonAims: Record<string, string>;
  ruleCompressions: Record<string, string>;
  runCommitments: Record<string, string>;
}

export interface LessonTextResultPublic {
  stored: boolean;
  reason: string | null;
  lessonKey: string;
  value: string | null;
}

export interface ActiveLessonPublic {
  slug: string;
  title: string;
  /** Manifest objective the lesson's questions are fenced under. */
  objectiveId: string;
  sectionAnchors: string[];
}

export interface CurrentContextPublic {
  objectiveId: string;
  sectionId: string;
  sectionTitle: string;
  concepts: string[];
  prerequisites: string[];
  lesson: ActiveLessonPublic | null;
}

export interface SubmitAnswerVerdictPublic {
  questionId: string;
  /**
   * Practice: the graded verdict. Exam: always null — correctness is
   * withheld until submit so submit_answer is never a mid-exam answer
   * oracle.
   */
  correct: boolean | null;
  misconceptionId: string | null;
  attemptNumber: number;
  attemptsRemaining: number;
  /**
   * Authored rationale, released only once the question is resolved
   * (correct, or attempts exhausted). Null while attempts remain on a miss —
   * the redaction gate for answer-adjacent prose.
   */
  rationale: string | null;
  /**
   * Same-lesson remediation anchor, present only on a miss. Names a lesson
   * section; carries no answer-key material.
   */
  remediationAnchor: string | null;
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
  /**
   * Engine refusal code on a rejected commit (e.g. 'reason-too-short',
   * 'no-mutation-this-round'). Process state only — never answer-key
   * material. Null when committed.
   */
  refusalReason: string | null;
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
   * states the routing table does not define (matches the engine's
   * RoutingVerdict union). `confidence: 'low'` after a correct answer routes
   * to `go_deeper`. `'rubric_interview'` = MCQ coverage thresholds met per
   * dimension but gate not passed — the engine invites the agent to run the
   * open-question interview and score the rubric.
   */
  requestNextAction(
    confidence?: 'low' | 'high',
  ): NextAction | 'continue' | 'rubric_interview';
  prescribeDrill(): DrillPrescriptionPublic;
  scoreRubric(submission: RubricSubmission): RubricVerdictPublic;
  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setLessonAim(aim: string): LessonTextResultPublic;
  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRuleCompression(text: string): LessonTextResultPublic;
  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRunCommitment(text: string): LessonTextResultPublic;
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
