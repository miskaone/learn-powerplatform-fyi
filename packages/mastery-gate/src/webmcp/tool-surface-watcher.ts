import { hasToolchangeEvents, type ModelContextLike } from './model-context';
import { canonicalToolOrder } from './tool-names';

export type ToolSurfaceWatcherMode = 'events' | 'polling';

/**
 * Watches the model-context tool surface for changes. `getTools()` is a
 * Promise on real runtimes (ChatGPT injected, Chrome origin trial), so every
 * read is awaited and every read is guarded — a rejected poll must never
 * become an uncaught error in a timer (that is precisely the crash that took
 * down /pl-400 on 2026-08-27; timer exceptions bypass React error boundaries).
 */
export class ToolSurfaceWatcher {
  public readonly mode: ToolSurfaceWatcherMode;

  private readonly ctx: ModelContextLike;
  private readonly pollIntervalMs: number;
  private readonly onError: (error: unknown) => void;
  private readonly callbacks = new Set<(toolNames: string[]) => void>();
  private readonly onToolchange = (): void => {
    void this.refresh();
  };

  private snapshotKey: string | null = null;
  private running = false;
  private refreshing = false;
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    ctx: ModelContextLike,
    options?: {
      pollIntervalMs?: number;
      onError?: (error: unknown) => void;
    },
  ) {
    this.ctx = ctx;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1500;
    this.onError =
      options?.onError ??
      ((error) => {
        console.error('[mastery-gate] tool surface read failed', error);
      });
    this.mode = hasToolchangeEvents(ctx) ? 'events' : 'polling';
  }

  onChange(cb: (toolNames: string[]) => void): () => void {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.refresh();
    if (this.mode === 'events') {
      this.ctx.addEventListener?.('toolchange', this.onToolchange);
      return;
    }
    this.intervalId = globalThis.setInterval(() => {
      void this.refresh();
    }, this.pollIntervalMs);
  }

  /** Reads the surface; emits to callbacks only when the name set changed. */
  async refresh(): Promise<void> {
    if (this.refreshing) {
      return; // a slow getTools() must not stack overlapping reads
    }
    this.refreshing = true;
    try {
      const names = await toolNames(this.ctx);
      const nextKey = snapshotKey(names);
      if (nextKey === this.snapshotKey) {
        return;
      }
      this.snapshotKey = nextKey;
      for (const cb of [...this.callbacks]) {
        cb(names);
      }
    } catch (error) {
      this.onError(error);
    } finally {
      this.refreshing = false;
    }
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.mode === 'events') {
      this.ctx.removeEventListener?.('toolchange', this.onToolchange);
      return;
    }
    if (this.intervalId !== undefined) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

async function toolNames(ctx: ModelContextLike): Promise<string[]> {
  // Promise.resolve normalizes both contract shapes (sync array, Promise).
  const tools = await Promise.resolve(ctx.getTools());
  // Canonical ordering shared with ToolRegistry.getRegisteredNames() — a
  // plain alphabetical sort here made the roster reshuffle between a
  // sync-driven update and the next poll tick.
  return canonicalToolOrder(tools.map((tool) => tool.name));
}

function snapshotKey(names: string[]): string {
  return names.join('\0');
}
