import type { FlipConditionScenario } from './rules/flipCondition';

/** Course phase that governs which tools are registered. */
export type ToolPhase =
  | 'lesson'
  | 'practice'
  | 'remediation'
  | 'drill'
  | 'exam'
  | 'debrief';

/** Engine-selected next pedagogical move after grading. */
export type NextAction = 'hint' | 'review' | 'coach' | 'go_deeper' | 'advance';

/** The four mastery dimensions; scored independently, never averaged. */
export type RubricDimension = 'recall' | 'connections' | 'application' | 'transfer';

/** Integer score 0–4 for a single rubric dimension. */
export type RubricScore = 0 | 1 | 2 | 3 | 4;

/** Per-dimension scores; never reduced to an average. */
export type RubricScores = Record<RubricDimension, RubricScore>;

/** Named wrong-model the bank maps distractors onto for remediation. */
export interface Misconception {
  id: string;
  name: string;
  contrast: string;
  socraticSeeds: string[];
  /** Lesson section id the engine routes to for remediation. */
  anchor: string;
}

/**
 * One selectable answer. `misconceptionId` is present on every distractor
 * and absent on the correct option.
 */
export interface QuestionOption {
  id: string;
  text: string;
  misconceptionId?: string;
}

/** Full bank item, including answer-key fields that never cross the tool boundary. */
export interface Question {
  id: string;
  objectiveId: string;
  concepts: string[];
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  rationale: string;
  remediationAnchor: string;
  /**
   * The authored mastery dimension this MCQ evidences. Drives the
   * per-dimension coverage computation behind the rubric-interview routing
   * verdict. NEVER crosses the tool boundary (`toQuestionPublic` stays
   * exactly as-is — do not add dimension to `QuestionPublic`).
   */
  dimension: RubricDimension;
}

/** A teachable unit that owns a set of instrumented questions. */
export interface Objective {
  id: string;
  title: string;
  summary: string;
  questionIds: string[];
}

/** Timed exam configuration owned by the content manifest. */
export interface ExamConfig {
  questionIds: string[];
  durationSeconds: number;
}

/** Frozen course payload the engine loads: objectives, items, and misconceptions. */
export interface ContentManifest {
  courseId: string;
  title: string;
  objectives: Objective[];
  questions: Question[];
  misconceptions: Misconception[];
  exam?: ExamConfig;
  flipScenarios?: FlipConditionScenario[];
}

/** Redacted option: id and visible text only — no misconception mapping. */
export interface QuestionOptionPublic {
  id: string;
  text: string;
}

/**
 * Redacted question that crosses the tool boundary.
 * Structurally lacks correctOptionId, rationale, remediationAnchor, and misconception mapping.
 */
export interface QuestionPublic {
  id: string;
  objectiveId: string;
  concepts: string[];
  prompt: string;
  options: QuestionOptionPublic[];
}

/**
 * Structural redaction: build a public question field-by-field.
 * Never spread and never delete — secrets cannot ride along.
 */
export function toQuestionPublic(q: Question): QuestionPublic {
  return {
    id: q.id,
    objectiveId: q.objectiveId,
    concepts: q.concepts,
    prompt: q.prompt,
    options: q.options.map((option) => {
      return {
        id: option.id,
        text: option.text,
      };
    }),
  };
}

/** One submitted choice, including whether it fired a named misconception. */
export interface AttemptRecord {
  questionId: string;
  optionId: string;
  correct: boolean;
  misconceptionId: string | null;
  timestamp: number;
}

/** One completed Flip-Condition drill round — a transfer-dimension practice event. */
export interface DrillResultRecord {
  scenarioId: string;
  assumptionId: string; // the mutated question-node id
  prediction: string;
  reason: string;
  outcomeId: string; // expectedOutcomeId of the matched row
  outcomeComponent: string; // expectedComponent of the matched row
  predictionWasCorrect: boolean;
  dimension: 'transfer';
  timestamp: number;
}

/** Active Flip-Condition drill session (survives reload). */
export interface DrillSessionState {
  scenarioId: string;
  round: number; // 1-based; increments after each reveal
  usedAssumptionIds: string[]; // assumptions already revealed this session
  currentAssumptionId: string | null; // the ONE mutation this round, engine-enforced
  prediction: { text: string; reason: string } | null;
}

/** One graded exam question verdict (post-submit only). */
export interface ExamVerdict {
  questionId: string;
  chosenOptionId: string | null; // null = unanswered
  correct: boolean;
  misconceptionId: string | null;
  concepts: string[];
}

/** Exam lifecycle state (survives reload). */
export interface ExamState {
  startedAt: number;
  durationSeconds: number;
  /**
   * High-water mark of every clock reading observed while the exam is
   * active. Elapsed time is computed against max(now, lastSeenAt), so an OS
   * clock rollback can never un-expire a running exam (cross-review MAJOR,
   * 2026-08-27).
   */
  lastSeenAt: number;
  questionIds: string[];
  answers: Record<string, string>; // questionId -> chosen optionId
  submitted: boolean;
  submittedAt: number | null;
  verdicts: ExamVerdict[]; // empty until submitted
}

/** Composed mastery-debrief playlist state (survives reload). */
export interface DebriefState {
  playlist: DebriefSegment[];
  currentIndex: number; // 0 = first segment is current
}

/** Kind of a durable coaching note (memory contract, ISC-75). */
export type CoachNoteKind = 'observation' | 'preference' | 'context';

/** One durable agent-authored coaching note. */
export interface CoachNote {
  text: string;
  kind: CoachNoteKind;
}

/** One recorded agent confidence hint, logged against the outcome it referred to (ISC-73). */
export interface ConfidenceHintRecord {
  confidence: 'low' | 'high';
  /** Correctness of the last graded attempt at the moment of the hint; null if none existed. */
  lastCorrect: boolean | null;
  timestamp: number;
}

/** One recorded rubric proposal outcome (ISC-73). */
export interface RubricProposalRecord {
  accepted: boolean;
  /** Gate state after the proposal was applied (accepted) or current gate state (rejected). */
  gatePassed: boolean;
  timestamp: number;
}

/** Authoritative learner state the engine owns; agent input is untrusted against this. */
export interface Ledger {
  attempts: AttemptRecord[];
  misconceptionFires: Record<string, number>;
  scores: RubricScores;
  coachNotes: CoachNote[];
  /**
   * Agent report card (ISC-73): append-only records of the agent's confidence
   * hints and rubric proposals against engine outcomes. Deterministic
   * bookkeeping only — NEVER read by routing, grading, or the gate.
   */
  confidenceHints: ConfidenceHintRecord[];
  rubricProposals: RubricProposalRecord[];
  phase: ToolPhase;
  drillResults: DrillResultRecord[];
  activeDrill: DrillSessionState | null;
  exam: ExamState | null;
  debrief: DebriefState | null;
  learnerName: string | null;
  /**
   * Learner-authored reflective artifacts (ACTOR pass, docs/actor-plan.md
   * §§1-3). Keyed by lesson slug, or the literal `"track"` when no lesson
   * is active. Validated and clamped on write and on load. NEVER admitted
   * to the rubric evidence corpus — learner/agent-authored text must not
   * launder itself into "verbatim evidence".
   */
  lessonAims: Record<string, string>;
  ruleCompressions: Record<string, string>;
  runCommitments: Record<string, string>;
}

/** Kind of a Mastery Debrief playlist beat. */
export type DebriefSegmentKind = 'title' | 'misconception' | 'rubric' | 'drill';

/** Storage clamp for debrief script lines loaded from persistence. */
export const MAX_SCRIPT_LINE_LENGTH = 300;

/**
 * One debrief playlist beat. `audioAsset` is a baked MP3 path in baked-audio
 * mode, or null in the text-card degrade.
 */
export interface DebriefSegment {
  id: string;
  kind: DebriefSegmentKind;
  scriptLine: string;
  audioAsset: string | null;
  misconceptionId?: string;
}

/** Live-narrator handshake: engine-approved script content only. */
export interface NarrationCue {
  segmentId: string;
  order: number;
  scriptLine: string;
}

/** The only environment abstraction allowed: string localStorage-shaped I/O. */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
