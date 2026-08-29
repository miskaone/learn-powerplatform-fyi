import type { EngineFacade, RegistrySnapshot } from './engine-facade';
import type { ModelContextLike, ToolDescriptor, ToolResponse } from './model-context';
import { textResponse } from './model-context';
import {
  ALL_TOOL_NAMES,
  EXAM_TOOL_NAMES,
  STATIC_TOOL_NAMES,
  type ToolName,
} from './tool-names';
import { createToolset } from './tools';

export type RevocationMode = 'deregister' | 'refusal';

export interface ToolRegistryOptions {
  revocationMode?: RevocationMode;
  /**
   * How long a revocation may wait on in-flight executions before the
   * registry reports the revocation as STUCK (logger + onStuckRevocation).
   * A warning threshold only — the drain-first law is absolute: the registry
   * NEVER aborts a registration while an execution is in flight
   * (docs/spike-verdicts.md §4; Chromium <153 kills in-flight calls).
   */
  drainWarnMs?: number;
  logger?: (message: string) => void;
  /**
   * Called once per revocation whose drain exceeds drainWarnMs. Surfaces the
   * wedge condition to the UI: a tool execution that never settles keeps its
   * revocation pending forever by design; this callback (and
   * getStuckRevocations()) is how that state becomes observable.
   */
  onStuckRevocation?: (name: ToolName) => void;
  toolsetOverride?: Partial<Record<ToolName, ToolDescriptor>>;
  disabledTools?: readonly ToolName[];
}

const EXAM_TOOL_NAME_SET: ReadonlySet<ToolName> = new Set(EXAM_TOOL_NAMES);
const DEFAULT_DRAIN_WARN_MS = 3000;

export function desiredToolNames(
  snapshot: RegistrySnapshot,
  mode: RevocationMode,
): Set<ToolName> {
  if (snapshot.phase === 'exam' && mode === 'deregister') {
    const examOnly: Set<ToolName> = new Set(['get_exam_status', 'submit_exam']);
    if (snapshot.examSubmitted) {
      examOnly.add('get_exam_debrief');
    }
    return examOnly;
  }

  const names: Set<ToolName> = new Set(STATIC_TOOL_NAMES);

  if (snapshot.gatePassed) {
    names.add('advance_module');
  }

  if (snapshot.repeatedMisconceptionIds.length > 0) {
    names.add('get_misconception_brief');
  }

  if (snapshot.phase === 'drill') {
    names.add('mutate_assumption');
    names.add('commit_prediction');
    if (snapshot.predictionCommitted) {
      names.add('reveal_outcome');
    }
  }

  if (snapshot.gatePassed && snapshot.phase !== 'exam') {
    names.add('start_exam');
  }

  if (snapshot.phase === 'exam') {
    names.add('get_exam_status');
    names.add('submit_exam');
    if (snapshot.examSubmitted) {
      names.add('get_exam_debrief');
    }
  }

  if (snapshot.moduleComplete) {
    names.add('compose_debrief');
    names.add('get_narration_script');
    names.add('advance_segment');
  }

  return names;
}

export class ToolRegistry {
  public readonly revocationMode: RevocationMode;

  private readonly ctx: ModelContextLike;
  private readonly descriptors = new Map<ToolName, ToolDescriptor>();
  private readonly controllers = new Map<ToolName, AbortController>();
  private readonly inFlight = new Map<ToolName, number>();
  private readonly drainWaiters = new Map<ToolName, Array<() => void>>();
  private readonly pendingRevocations = new Map<ToolName, Promise<void>>();
  private readonly stuckRevocations = new Set<ToolName>();
  private readonly resyncQueued = new Set<ToolName>();
  private readonly drainWarnMs: number;
  private readonly logger: (message: string) => void;
  private readonly onStuckRevocation: ((name: ToolName) => void) | undefined;
  private lastSnapshot: RegistrySnapshot | null = null;
  private refusalActive = false;
  private readonly disabledTools: ReadonlySet<ToolName>;

  constructor(
    ctx: ModelContextLike,
    engine: EngineFacade,
    options?: ToolRegistryOptions,
  ) {
    this.ctx = ctx;
    this.revocationMode = options?.revocationMode ?? 'deregister';
    this.drainWarnMs = options?.drainWarnMs ?? DEFAULT_DRAIN_WARN_MS;
    this.onStuckRevocation = options?.onStuckRevocation;
    this.logger =
      options?.logger ??
      ((message: string) => {
        console.warn(message);
      });
    this.disabledTools = new Set(options?.disabledTools ?? []);
    const toolset: Record<ToolName, ToolDescriptor> = {
      ...createToolset(engine),
      ...options?.toolsetOverride,
    };
    for (const name of ALL_TOOL_NAMES) {
      const original = toolset[name];
      const inner = EXAM_TOOL_NAME_SET.has(name)
        ? original
        : this.guard(original);
      this.descriptors.set(name, this.track(name, inner));
    }
  }

  async sync(snapshot: RegistrySnapshot): Promise<void> {
    this.lastSnapshot = snapshot;
    const desired = desiredToolNames(snapshot, this.revocationMode);
    for (const name of this.disabledTools) {
      desired.delete(name);
    }
    this.refusalActive =
      this.revocationMode === 'refusal' && snapshot.phase === 'exam';

    // Awaited alongside revocations so sync() does not resolve while
    // registerTool promises are still pending — getRegisteredNames() must
    // not report tools the agent cannot yet see (cross-review MINOR 14).
    // Safe to await: registration settles promptly on real runtimes; the
    // never-settling hazard is executions, which drain-first already covers.
    const registrations: Promise<void>[] = [];

    for (const name of ALL_TOOL_NAMES) {
      if (!desired.has(name)) {
        continue;
      }
      const pending = this.pendingRevocations.get(name);
      if (pending !== undefined) {
        // The tool is mid-revocation. Never await the drain here — a wedged
        // execution would hang every future sync. Queue at most ONE re-sync
        // continuation on the shared revocation promise instead.
        this.queueResyncAfterRevocation(name, pending);
        continue;
      }
      if (this.controllers.has(name)) {
        continue;
      }
      const descriptor = this.descriptors.get(name);
      if (descriptor === undefined) {
        continue;
      }
      const controller = new AbortController();
      this.controllers.set(name, controller);
      // registerTool returns a Promise on real runtimes — a rejection must
      // surface through the logger, never as an unhandled rejection, and a
      // failed registration must not leave a phantom controller behind.
      // The rejection handler compares controller IDENTITY before deleting:
      // a stale rejection arriving after this tool was revoked and
      // re-registered must not delete the LATER live controller
      // (cross-review MAJOR 12, 2026-08-27).
      const registration = Promise.resolve(
        this.ctx.registerTool(descriptor, { signal: controller.signal }),
      ).then(
        () => undefined,
        (error) => {
          if (this.controllers.get(name) === controller) {
            this.controllers.delete(name);
          }
          this.logger(`registerTool(${name}) rejected: ${String(error)}`);
        },
      );
      registrations.push(registration);
    }

    const revocations: Promise<void>[] = [];
    for (const name of ALL_TOOL_NAMES) {
      if (!desired.has(name) && this.controllers.has(name)) {
        const revocation = this.revokeTool(name);
        // A revocation already reported stuck may never settle (wedge
        // condition: a never-settling execute keeps the drain open forever
        // by design — drain-first law). Awaiting it again would chain one
        // more reaction onto the shared promise per sync call; the single
        // pending revocation already covers it, so skip the await.
        if (!this.stuckRevocations.has(name)) {
          revocations.push(revocation);
        }
      }
    }
    await Promise.all([...registrations, ...revocations]);
  }

  getRegisteredNames(): ToolName[] {
    return ALL_TOOL_NAMES.filter((name) => this.controllers.has(name));
  }

  /**
   * The registry-wrapped descriptor for a tool — the exact execute an agent
   * runtime invokes: in-flight tracking, the mid-drain `tool-revoked`
   * refusal, and (in refusal mode) the exam-in-progress guard all apply.
   * Any in-app surface that invokes tools directly (the Tool Inspector)
   * MUST go through these wrappers, never the raw toolset, so no invocation
   * path can skip the registry guard layer (cross-review finding 1,
   * 2026-08-28).
   */
  getWrappedDescriptor(name: ToolName): ToolDescriptor | undefined {
    return this.descriptors.get(name);
  }

  /**
   * Tools whose revocation drain has exceeded drainWarnMs and is still
   * waiting on an in-flight execution. Empties again if the execution
   * eventually settles (the drain then completes and the abort proceeds).
   */
  getStuckRevocations(): ToolName[] {
    return ALL_TOOL_NAMES.filter((name) => this.stuckRevocations.has(name));
  }

  /**
   * Registers a single continuation per tool that re-runs sync with the
   * latest snapshot once a pending revocation settles — so a tool that
   * becomes desired again while draining is re-registered without stacking
   * one reaction per sync call on the shared revocation promise.
   */
  private queueResyncAfterRevocation(
    name: ToolName,
    pending: Promise<void>,
  ): void {
    if (this.resyncQueued.has(name)) {
      return;
    }
    this.resyncQueued.add(name);
    void pending.then(() => {
      this.resyncQueued.delete(name);
      const snapshot = this.lastSnapshot;
      if (snapshot !== null) {
        void this.sync(snapshot);
      }
    });
  }

  private revokeTool(name: ToolName): Promise<void> {
    const existing = this.pendingRevocations.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const promise = this.performRevoke(name).finally(() => {
      this.pendingRevocations.delete(name);
    });
    this.pendingRevocations.set(name, promise);
    return promise;
  }

  private async performRevoke(name: ToolName): Promise<void> {
    const controller = this.controllers.get(name);
    if (controller === undefined) {
      return;
    }

    if ((this.inFlight.get(name) ?? 0) > 0) {
      // Wedge condition (documented): if an execution never settles, this
      // drain never completes and the revocation stays pending forever —
      // deliberately, per the drain-first law (docs/spike-verdicts.md §4:
      // never abort while in flight). The stuck state is made observable
      // via logger + onStuckRevocation + getStuckRevocations(), and sync()
      // is guarded so repeated calls never stack on the pending promise.
      let warnId: ReturnType<typeof setTimeout> | undefined;
      warnId = setTimeout(() => {
        this.stuckRevocations.add(name);
        this.logger(
          `Tool ${name} drain exceeded ${this.drainWarnMs}ms; still waiting for in-flight executions to settle before abort`,
        );
        this.onStuckRevocation?.(name);
      }, this.drainWarnMs);
      try {
        await this.whenDrained(name);
      } finally {
        if (warnId !== undefined) {
          clearTimeout(warnId);
        }
        this.stuckRevocations.delete(name);
      }
    }

    controller.abort();
    this.controllers.delete(name);
  }

  private whenDrained(name: ToolName): Promise<void> {
    return new Promise((resolve) => {
      if ((this.inFlight.get(name) ?? 0) === 0) {
        resolve();
        return;
      }
      let waiters = this.drainWaiters.get(name);
      if (waiters === undefined) {
        waiters = [];
        this.drainWaiters.set(name, waiters);
      }
      waiters.push(resolve);
      if ((this.inFlight.get(name) ?? 0) === 0) {
        this.resolveDrainWaiters(name);
      }
    });
  }

  private resolveDrainWaiters(name: ToolName): void {
    const waiters = this.drainWaiters.get(name);
    if (waiters === undefined) {
      return;
    }
    this.drainWaiters.delete(name);
    for (const waiter of waiters) {
      waiter();
    }
  }

  private track(name: ToolName, descriptor: ToolDescriptor): ToolDescriptor {
    return {
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
      ...(descriptor.annotations !== undefined
        ? { annotations: descriptor.annotations }
        : {}),
      execute: async (input: unknown): Promise<ToolResponse> => {
        // Compensating engine-side refusal for the drain wedge
        // (cross-review finding 16): while this tool's revocation is
        // draining, the registration is still live on the runtime — a NEW
        // invocation arriving in that window must refuse rather than run a
        // revoked capability (e.g. a coaching tool after start_exam).
        // Executions already in flight settle normally (drain-first law).
        if (this.pendingRevocations.has(name)) {
          return textResponse({
            refused: true,
            reason: 'tool-revoked',
            tool: descriptor.name,
          });
        }
        this.inFlight.set(name, (this.inFlight.get(name) ?? 0) + 1);
        try {
          return await descriptor.execute(input);
        } finally {
          const remaining = (this.inFlight.get(name) ?? 1) - 1;
          if (remaining <= 0) {
            this.inFlight.delete(name);
            this.resolveDrainWaiters(name);
          } else {
            this.inFlight.set(name, remaining);
          }
        }
      },
    };
  }

  private guard(descriptor: ToolDescriptor): ToolDescriptor {
    return {
      name: descriptor.name,
      description: descriptor.description,
      inputSchema: descriptor.inputSchema,
      ...(descriptor.annotations !== undefined
        ? { annotations: descriptor.annotations }
        : {}),
      execute: async (input: unknown): Promise<ToolResponse> => {
        if (this.refusalActive) {
          return textResponse({
            refused: true,
            reason: 'exam-in-progress',
            tool: descriptor.name,
          });
        }
        return descriptor.execute(input);
      },
    };
  }
}
