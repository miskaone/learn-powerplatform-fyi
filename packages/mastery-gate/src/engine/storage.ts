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
