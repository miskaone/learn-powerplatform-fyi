import type {
  AttemptRecord,
  Ledger,
  RubricScore,
  StorageAdapter,
  ToolPhase,
} from '../schema';
import type { GradeResult } from './grading';
import type { HintState } from './hints';

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

export function loadState(adapter: StorageAdapter): PersistedState | null {
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
    const ledger = validateLedger(parsed.ledger);
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

function validateLedger(value: unknown): Ledger | null {
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
  return {
    attempts: validatedAttempts,
    misconceptionFires: { ...misconceptionFires },
    scores: { recall, connections, application, transfer },
    coachNotes: coachNotes.slice() as string[],
    phase,
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
