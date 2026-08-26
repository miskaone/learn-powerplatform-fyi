import type { Ledger, StorageAdapter } from '../schema';
import type { HintState } from './hints';

export const STORAGE_KEY = 'mastery-gate:v1';

export interface PersistedState {
  version: 1;
  ledger: Ledger;
  hints: HintState;
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
    if (!isRecord(parsed.ledger) || !isRecord(parsed.hints)) {
      return null;
    }

    return {
      version: 1,
      ledger: parsed.ledger as unknown as Ledger,
      hints: parsed.hints as unknown as HintState,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
