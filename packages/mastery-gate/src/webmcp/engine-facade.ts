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
  coachingNotes: {
    text: string;
    kind: 'observation' | 'preference' | 'context';
  }[];
  coachCalibration: {
    confidenceHintCount: number;
    confidenceAgreements: number;
    highConfidenceMisses: number;
    rubricProposalCount: number;
    rubricProposalsAccepted: number;
  } | null;
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
  /** Each anchor carries the title of the section it names. */
  sectionAnchors: LessonSectionAnchorPublic[];
}

/** A lesson-page section anchor plus the title of the section it names. */
export interface LessonSectionAnchorPublic {
  anchor: string;
  title: string;
}

export interface LessonBriefConceptPublic {
  id: string;
  label: string;
  importance: string;
  summary: string;
}

export interface LessonBriefDistractorPublic {
  choice: string;
  whyTempting: string;
  whyWrong: string;
}

export interface LessonBriefVisualStepPublic {
  label: string;
  state: string;
  detail: string;
}

export interface LessonBriefVisualPublic {
  type: string;
  title: string;
  steps: LessonBriefVisualStepPublic[];
}

export interface LessonBriefDrillsPublic {
  recall: string;
  connections: string;
  application: string;
  transfer: string;
}

export interface LessonBriefReferencePublic {
  label: string;
  url: string;
}

/**
 * The authored teaching material for the active lesson.
 *
 * The agent gets exactly what a learner reading the page gets. No more, no less.
 *
 * INCLUDED because the lesson page renders it to every reader: title, epigraph, governing rule, exam
 * clue, mnemonic, the scenario prompt, the concept hierarchy, the distractor teardown (choice /
 * whyTempting / whyWrong — section 05 of the page, ungated), the visual walkthrough steps (section 04),
 * production nuance, the four targeted drills and the reflection prompts (section 07), the section
 * anchors with titles, references.
 * scenarioExpectedAnswer: null until the learner commits their own answer and the page reveals it;
 * non-null thereafter, mirroring exactly what is then on the learner's screen. It is never prerendered
 * and never reaches this type except through the app layer's post-commit reveal.
 * EXCLUDED, structurally (these fields do not exist on this type): question rationales, correctOptionId,
 * and option->misconception mapping — answer-key material the page never shows, absent from every tool payload.
 */
export interface LessonBriefPublic {
  id: string;
  slug: string;
  title: string;
  topicTitle: string;
  objectiveId: string;
  heroEpigraph: string;
  governingRule: string;
  examClue: string;
  mnemonic: string | null;
  scenarioPrompt: string;
  /** Ordering-exercise components, in the page's scrambled display order; empty for plain-prose scenarios. */
  scenarioOrderItems: string[];
  concepts: LessonBriefConceptPublic[];
  productionNuance: string[];
  scenarioExpectedAnswer: string | null;
  distractors: LessonBriefDistractorPublic[];
  visual: LessonBriefVisualPublic;
  drills: LessonBriefDrillsPublic;
  reflection: string[];
  sections: LessonSectionAnchorPublic[];
  references: LessonBriefReferencePublic[];
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
  /**
   * Present only on a correct practice verdict: the distractor-myth this
   * correct answer defeats (id + public name). Never present mid-exam or on
   * a miss. Names are post-fire-public material — no new leak surface.
   */
  defeatedMisconception: { id: string; name: string } | null;
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

export type FocusPreset = 'focus-section' | 'clear-focus' | 'exam-lighting';

export interface SetFocusResultPublic {
  ok: boolean;
  preset: FocusPreset;
  anchor: string | null;
  reason: string | null;
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
  /**
   * The authored lesson material for the route-derived active lesson, or
   * null when no lesson is active or an exam is in progress (engine-level
   * exam guard — deregistration is defense in depth, not the only guard).
   */
  getLessonBrief(): LessonBriefPublic | null;
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
   * Keyed by the explicit lessonKey when provided (page surfaces pass the
   * slug they render under so read and write can never diverge —
   * cross-review fix 2026-08-28), else by the route-derived active lesson
   * slug, or 'track' when no lesson is active; learner/agent-authored
   * reflective text — persisted on the ledger, exposed via getLearnerState,
   * NEVER admitted to the rubric evidence corpus; engine-guarded against
   * exam-mode writes.
   */
  setLessonAim(aim: string, lessonKey?: string): LessonTextResultPublic;
  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRuleCompression(text: string, lessonKey?: string): LessonTextResultPublic;
  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRunCommitment(text: string, lessonKey?: string): LessonTextResultPublic;
  logCoachingNote(
    note: string,
    kind?: 'observation' | 'preference' | 'context',
  ): { stored: boolean; reason: string | null };
  navigateToAnchor(anchor: string): NavigateResultPublic;
  /**
   * Stage lighting for coaching. Effects are a FIXED set of page CSS
   * presets applied by a UI-supplied callback — the input never carries
   * style strings. `focus-section` requires an anchor validated against
   * the active lesson's section anchors. ENGINE-LEVEL EXAM GUARD — while
   * an exam is active every preset except `clear-focus` is refused
   * (reason `'exam-active'`), because agent-less surfaces execute without
   * a registry (deregistration of set_focus during exam-mode deregister
   * sync is defense in depth, not the guard).
   */
  setFocus(preset: FocusPreset, anchor?: string): SetFocusResultPublic;
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
