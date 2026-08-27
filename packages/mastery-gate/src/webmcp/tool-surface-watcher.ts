import { hasToolchangeEvents, type ModelContextLike } from './model-context';
import { canonicalToolOrder } from './tool-names';

export type ToolSurfaceWatcherMode = 'events' | 'polling';

export class ToolSurfaceWatcher {
  public readonly mode: ToolSurfaceWatcherMode;

  private readonly ctx: ModelContextLike;
  private readonly pollIntervalMs: number;
  private readonly callbacks = new Set<(toolNames: string[]) => void>();
  private readonly onToolchange = (): void => {
    this.refresh();
  };

  private snapshotKey: string;
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(ctx: ModelContextLike, options?: { pollIntervalMs?: number }) {
    this.ctx = ctx;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1500;
    this.mode = hasToolchangeEvents(ctx) ? 'events' : 'polling';
    this.snapshotKey = snapshotKey(toolNames(ctx));
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
    this.snapshotKey = snapshotKey(toolNames(this.ctx));
    if (this.mode === 'events') {
      this.ctx.addEventListener?.('toolchange', this.onToolchange);
      return;
    }
    this.intervalId = globalThis.setInterval(() => {
      this.refresh();
    }, this.pollIntervalMs);
  }

  refresh(): void {
    const names = toolNames(this.ctx);
    const nextKey = snapshotKey(names);
    if (nextKey === this.snapshotKey) {
      return;
    }
    this.snapshotKey = nextKey;
    for (const cb of [...this.callbacks]) {
      cb(names);
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

function toolNames(ctx: ModelContextLike): string[] {
  // Canonical ordering shared with ToolRegistry.getRegisteredNames() — a
  // plain alphabetical sort here made the roster reshuffle between a
  // sync-driven update and the next poll tick.
  return canonicalToolOrder(ctx.getTools().map((tool) => tool.name));
}

function snapshotKey(names: string[]): string {
  return names.join('\0');
}
