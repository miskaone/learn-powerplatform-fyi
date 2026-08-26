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
}

/** A teachable unit that owns a set of instrumented questions. */
export interface Objective {
  id: string;
  title: string;
  summary: string;
  questionIds: string[];
}

/** Frozen course payload the engine loads: objectives, items, and misconceptions. */
export interface ContentManifest {
  courseId: string;
  title: string;
  objectives: Objective[];
  questions: Question[];
  misconceptions: Misconception[];
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

/** Authoritative learner state the engine owns; agent input is untrusted against this. */
export interface Ledger {
  attempts: AttemptRecord[];
  misconceptionFires: Record<string, number>;
  scores: RubricScores;
  coachNotes: string[];
  phase: ToolPhase;
}

/** Kind of a Mastery Debrief playlist beat. */
export type DebriefSegmentKind = 'title' | 'misconception' | 'rubric' | 'drill';

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
