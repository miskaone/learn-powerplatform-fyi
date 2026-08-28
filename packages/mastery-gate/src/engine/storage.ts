import type {
  AttemptRecord,
  DebriefSegment,
  DebriefSegmentKind,
  DebriefState,
  DrillResultRecord,
  DrillSessionState,
  ExamState,
  ExamVerdict,
  Ledger,
  RubricScore,
  StorageAdapter,
  ToolPhase,
} from '../schema';
import { MAX_SCRIPT_LINE_LENGTH } from '../schema';
import type { GradeResult } from './grading';
import type { HintState } from './hints';
import { clampCoachNotes, MAX_LEARNER_NAME_LENGTH } from './ledger';
import {
  MAX_PREDICTION_LENGTH,
  MAX_PREDICTION_REASON_LENGTH,
} from './drill';
import {
  MAX_EXAM_DURATION_SECONDS,
  MIN_EXAM_DURATION_SECONDS,
} from './exam';

export const STORAGE_KEY = 'mastery-gate:v1';

export interface PersistedState {
  version: 1;
  ledger: Ledger;
  hints: HintState;
  /**
   * Routing input for requestNextAction. Persisted so the hint/review/coach
   * verdict survives a page reload alongside the attempt that produced it
   * (older records lack the field; it loads as null).
   */
  lastGrade: GradeResult | null;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    if (!this.store.has(key)) {
      return null;
    }
    return this.store.get(key) as string;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  private backing: LocalStorageLike | null;
  private readonly memory = new MemoryStorageAdapter();
  private degraded: boolean;

  constructor(backing?: LocalStorageLike | null) {
    if (backing === undefined) {
      try {
        const fromGlobal = (globalThis as { localStorage?: LocalStorageLike })
          .localStorage;
        this.backing = fromGlobal ?? null;
      } catch {
        this.backing = null;
      }
    } else {
      this.backing = backing;
    }
    this.degraded = this.backing === null;
    if (this.backing !== null) {
      try {
        this.backing.setItem('mastery-gate:probe', '1');
        this.backing.removeItem('mastery-gate:probe');
      } catch {
        this.degraded = true;
      }
    }
  }

  get isDegraded(): boolean {
    return this.degraded;
  }

  getItem(key: string): string | null {
    const backing = this.usableBacking();
    if (backing === null) {
      return this.memory.getItem(key);
    }
    try {
      return backing.getItem(key);
    } catch {
      this.degraded = true;
      return this.memory.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    this.memory.setItem(key, value);
    const backing = this.usableBacking();
    if (backing === null) {
      return;
    }
    try {
      backing.setItem(key, value);
    } catch {
      this.degraded = true;
    }
  }

  removeItem(key: string): void {
    this.memory.removeItem(key);
    const backing = this.usableBacking();
    if (backing === null) {
      return;
    }
    try {
      backing.removeItem(key);
    } catch {
      this.degraded = true;
    }
  }

  private usableBacking(): LocalStorageLike | null {
    if (this.degraded) {
      return null;
    }
    return this.backing;
  }
}

export function saveState(
  adapter: StorageAdapter,
  state: PersistedState,
): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(
  adapter: StorageAdapter,
  now: number = Date.now(),
): PersistedState | null {
  try {
    const raw = adapter.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    if (parsed.version !== 1) {
      return null;
    }
    const ledger = validateLedger(parsed.ledger, now);
    const hints = validateHints(parsed.hints);
    if (ledger === null || hints === null) {
      return null;
    }
    // Absent in records written before lastGrade was persisted; treat as null.
    const rawLastGrade = parsed.lastGrade;
    let lastGrade: GradeResult | null = null;
    if (rawLastGrade !== undefined && rawLastGrade !== null) {
      lastGrade = validateGradeResult(rawLastGrade);
      if (lastGrade === null) {
        return null;
      }
    }

    return { version: 1, ledger, hints, lastGrade };
  } catch {
    return null;
  }
}

const TOOL_PHASES: readonly ToolPhase[] = [
  'lesson',
  'practice',
  'remediation',
  'drill',
  'exam',
  'debrief',
];

function isRubricScore(value: unknown): value is RubricScore {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4
  );
}

function isToolPhase(value: unknown): value is ToolPhase {
  return (
    typeof value === 'string' && (TOOL_PHASES as readonly string[]).includes(value)
  );
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      return false;
    }
  }
  return true;
}

function validateAttempt(value: unknown): AttemptRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const { questionId, optionId, correct, misconceptionId, timestamp } = value;
  if (
    typeof questionId !== 'string' ||
    typeof optionId !== 'string' ||
    typeof correct !== 'boolean' ||
    (misconceptionId !== null && typeof misconceptionId !== 'string') ||
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }
  return {
    questionId,
    optionId,
    correct,
    misconceptionId: misconceptionId ?? null,
    timestamp,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (typeof value[key] !== 'string') {
      return false;
    }
  }
  return true;
}

function copyStringRecord(record: Record<string, string>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    copy[key] = record[key];
  }
  return copy;
}

function validateDrillResult(value: unknown): DrillResultRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const {
    scenarioId,
    assumptionId,
    prediction,
    reason,
    outcomeId,
    outcomeComponent,
    predictionWasCorrect,
    dimension,
    timestamp,
  } = value;
  if (
    typeof scenarioId !== 'string' ||
    typeof assumptionId !== 'string' ||
    typeof prediction !== 'string' ||
    typeof reason !== 'string' ||
    typeof outcomeId !== 'string' ||
    typeof outcomeComponent !== 'string' ||
    typeof predictionWasCorrect !== 'boolean' ||
    dimension !== 'transfer' ||
    !isFiniteNumber(timestamp)
  ) {
    return null;
  }
  return {
    scenarioId,
    assumptionId,
    prediction: prediction.slice(0, MAX_PREDICTION_LENGTH),
    reason: reason.slice(0, MAX_PREDICTION_REASON_LENGTH),
    outcomeId,
    outcomeComponent,
    predictionWasCorrect,
    dimension: 'transfer',
    timestamp,
  };
}

function validateActiveDrill(value: unknown): DrillSessionState | null {
  if (!isRecord(value)) {
    return null;
  }
  const {
    scenarioId,
    round,
    usedAssumptionIds,
    currentAssumptionId,
    prediction,
  } = value;
  if (
    typeof scenarioId !== 'string' ||
    !Number.isInteger(round) ||
    typeof round !== 'number' ||
    round < 1 ||
    !isStringArray(usedAssumptionIds) ||
    (currentAssumptionId !== null && typeof currentAssumptionId !== 'string')
  ) {
    return null;
  }

  let clonedPrediction: { text: string; reason: string } | null = null;
  if (prediction !== null) {
    if (!isRecord(prediction)) {
      return null;
    }
    if (typeof prediction.text !== 'string' || typeof prediction.reason !== 'string') {
      return null;
    }
    // One-mutation-per-round invariant: a committed prediction requires the
    // assumption lock. A persisted record with prediction set but the lock
    // cleared would let a fresh assumption be mutated under an old prediction
    // (cross-review MAJOR 10, 2026-08-27).
    if (currentAssumptionId === null) {
      return null;
    }
    clonedPrediction = {
      text: prediction.text.slice(0, MAX_PREDICTION_LENGTH),
      reason: prediction.reason.slice(0, MAX_PREDICTION_REASON_LENGTH),
    };
  }

  return {
    scenarioId,
    round,
    usedAssumptionIds: usedAssumptionIds.slice(),
    currentAssumptionId,
    prediction: clonedPrediction,
  };
}

function validateExamVerdict(value: unknown): ExamVerdict | null {
  if (!isRecord(value)) {
    return null;
  }
  const { questionId, chosenOptionId, correct, misconceptionId, concepts } = value;
  if (
    typeof questionId !== 'string' ||
    (chosenOptionId !== null && typeof chosenOptionId !== 'string') ||
    typeof correct !== 'boolean' ||
    (misconceptionId !== null && typeof misconceptionId !== 'string') ||
    !isStringArray(concepts)
  ) {
    return null;
  }
  return {
    questionId,
    chosenOptionId,
    correct,
    misconceptionId,
    concepts: concepts.slice(),
  };
}

function validateExam(value: unknown, now: number): ExamState | null {
  if (!isRecord(value)) {
    return null;
  }
  const {
    startedAt,
    durationSeconds,
    lastSeenAt,
    questionIds,
    answers,
    submitted,
    submittedAt,
    verdicts,
  } = value;
  if (
    !isFiniteNumber(startedAt) ||
    !isFiniteNumber(durationSeconds) ||
    !isStringArray(questionIds) ||
    !isStringRecord(answers) ||
    typeof submitted !== 'boolean' ||
    (submittedAt !== null && !isFiniteNumber(submittedAt)) ||
    !Array.isArray(verdicts)
  ) {
    return null;
  }
  // A record whose exam started in the future is tampered or clock-skewed
  // beyond repair — reject it rather than granting billions of remaining
  // seconds (cross-review MAJOR 7, 2026-08-27).
  if (startedAt > now) {
    return null;
  }
  // Duration is clamped on the reload path exactly as on the creation path
  // — the [MIN, MAX] invariant must hold on every path (cross-review
  // MAJOR 7).
  const clampedDuration = Math.min(
    MAX_EXAM_DURATION_SECONDS,
    Math.max(MIN_EXAM_DURATION_SECONDS, durationSeconds),
  );
  // Absent in records written before the clock watermark landed; never
  // allowed below startedAt.
  let validatedLastSeenAt = startedAt;
  if (lastSeenAt !== undefined) {
    if (!isFiniteNumber(lastSeenAt)) {
      return null;
    }
    validatedLastSeenAt = Math.max(startedAt, lastSeenAt);
  }
  const validatedVerdicts: ExamVerdict[] = [];
  for (const verdict of verdicts) {
    const validated = validateExamVerdict(verdict);
    if (validated === null) {
      return null;
    }
    validatedVerdicts.push(validated);
  }
  return {
    startedAt,
    durationSeconds: clampedDuration,
    lastSeenAt: validatedLastSeenAt,
    questionIds: questionIds.slice(),
    answers: copyStringRecord(answers),
    submitted,
    submittedAt,
    verdicts: validatedVerdicts,
  };
}

const DEBRIEF_KINDS: readonly DebriefSegmentKind[] = [
  'title',
  'misconception',
  'rubric',
  'drill',
];

function isDebriefKind(value: unknown): value is DebriefSegmentKind {
  return (
    typeof value === 'string' &&
    (DEBRIEF_KINDS as readonly string[]).includes(value)
  );
}

function validateDebriefSegment(value: unknown): DebriefSegment | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, kind, scriptLine, audioAsset, misconceptionId } = value;
  if (
    typeof id !== 'string' ||
    !isDebriefKind(kind) ||
    typeof scriptLine !== 'string' ||
    (audioAsset !== null && typeof audioAsset !== 'string')
  ) {
    return null;
  }
  if (misconceptionId !== undefined && typeof misconceptionId !== 'string') {
    return null;
  }
  const segment: DebriefSegment = {
    id,
    kind,
    scriptLine: scriptLine.slice(0, MAX_SCRIPT_LINE_LENGTH),
    audioAsset,
  };
  if (misconceptionId !== undefined) {
    segment.misconceptionId = misconceptionId;
  }
  return segment;
}

function validateDebrief(value: unknown): DebriefState | null {
  if (!isRecord(value)) {
    return null;
  }
  const { playlist, currentIndex } = value;
  if (!Array.isArray(playlist) || !Number.isInteger(currentIndex)) {
    return null;
  }
  if (typeof currentIndex !== 'number' || currentIndex < 0) {
    return null;
  }
  const validatedPlaylist: DebriefSegment[] = [];
  for (const segment of playlist) {
    const validated = validateDebriefSegment(segment);
    if (validated === null) {
      return null;
    }
    validatedPlaylist.push(validated);
  }
  if (currentIndex >= validatedPlaylist.length) {
    return null;
  }
  return {
    playlist: validatedPlaylist,
    currentIndex,
  };
}

function validateLearnerName(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.slice(0, MAX_LEARNER_NAME_LENGTH);
}

function validateLedger(value: unknown, now: number): Ledger | null {
  if (!isRecord(value)) {
    return null;
  }
  const { attempts, misconceptionFires, scores, coachNotes, phase } = value;
  if (!Array.isArray(attempts)) {
    return null;
  }
  const validatedAttempts: AttemptRecord[] = [];
  for (const attempt of attempts) {
    const validated = validateAttempt(attempt);
    if (validated === null) {
      return null;
    }
    validatedAttempts.push(validated);
  }
  if (!isNumberRecord(misconceptionFires)) {
    return null;
  }
  if (!isRecord(scores)) {
    return null;
  }
  const { recall, connections, application, transfer } = scores;
  if (
    !isRubricScore(recall) ||
    !isRubricScore(connections) ||
    !isRubricScore(application) ||
    !isRubricScore(transfer)
  ) {
    return null;
  }
  if (
    !Array.isArray(coachNotes) ||
    coachNotes.some((note) => typeof note !== 'string')
  ) {
    return null;
  }
  if (!isToolPhase(phase)) {
    return null;
  }

  let drillResults: DrillResultRecord[] = [];
  if (value.drillResults !== undefined) {
    if (!Array.isArray(value.drillResults)) {
      return null;
    }
    drillResults = [];
    for (const entry of value.drillResults) {
      const validated = validateDrillResult(entry);
      if (validated === null) {
        return null;
      }
      drillResults.push(validated);
    }
  }

  let activeDrill: DrillSessionState | null = null;
  if (value.activeDrill !== undefined && value.activeDrill !== null) {
    const validated = validateActiveDrill(value.activeDrill);
    if (validated === null) {
      return null;
    }
    activeDrill = validated;
  }

  let exam: ExamState | null = null;
  if (value.exam !== undefined && value.exam !== null) {
    const validated = validateExam(value.exam, now);
    if (validated === null) {
      return null;
    }
    exam = validated;
  }

  // Cross-field consistency (cross-review BLOCKER 5, 2026-08-27): each
  // field validated in isolation allowed a type-valid record whose phase
  // said "practice" while an unsubmitted exam was live — a reload then
  // re-registered the whole coaching surface mid-exam. An active exam
  // REQUIRES phase 'exam' and no active drill; phase 'exam' REQUIRES an
  // exam record.
  if (exam !== null && !exam.submitted) {
    if (phase !== 'exam' || activeDrill !== null) {
      return null;
    }
  }
  if (phase === 'exam' && exam === null) {
    return null;
  }

  let debrief: DebriefState | null = null;
  if (value.debrief !== undefined && value.debrief !== null) {
    const validated = validateDebrief(value.debrief);
    if (validated === null) {
      return null;
    }
    debrief = validated;
  }

  let learnerName: string | null = null;
  if (value.learnerName !== undefined) {
    if (value.learnerName !== null && typeof value.learnerName !== 'string') {
      return null;
    }
    const validated = validateLearnerName(value.learnerName);
    if (validated === undefined && value.learnerName !== undefined) {
      return null;
    }
    learnerName = validated === undefined ? null : validated;
  }

  return {
    attempts: validatedAttempts,
    misconceptionFires: { ...misconceptionFires },
    scores: { recall, connections, application, transfer },
    // Tampered/oversized persisted notes are clamped, not rejected.
    coachNotes: clampCoachNotes(coachNotes as string[]),
    phase,
    drillResults,
    activeDrill,
    exam,
    debrief,
    learnerName,
  };
}

function validateHints(value: unknown): HintState | null {
  if (!isRecord(value)) {
    return null;
  }
  const tiersIssued = value.tiersIssued;
  if (!isNumberRecord(tiersIssued)) {
    return null;
  }
  return { tiersIssued: { ...tiersIssued } };
}

function validateGradeResult(value: unknown): GradeResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const { questionId, optionId, correct, misconceptionId } = value;
  if (
    typeof questionId !== 'string' ||
    typeof optionId !== 'string' ||
    typeof correct !== 'boolean' ||
    (misconceptionId !== null && typeof misconceptionId !== 'string')
  ) {
    return null;
  }
  return { questionId, optionId, correct, misconceptionId: misconceptionId ?? null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
