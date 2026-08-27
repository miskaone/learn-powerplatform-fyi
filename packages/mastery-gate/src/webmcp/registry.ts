import type { ToolPhase } from '../schema';
import type { EngineFacade } from './engine-facade';
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

export interface RegistrySnapshot {
  phase: ToolPhase;
  gatePassed: boolean;
  repeatedMisconceptionIds: string[];
  predictionCommitted: boolean;
  examSubmitted: boolean;
  moduleComplete: boolean;
}

export interface ToolRegistryOptions {
  revocationMode?: RevocationMode;
  drainTimeoutMs?: number;
  logger?: (message: string) => void;
  toolsetOverride?: Partial<Record<ToolName, ToolDescriptor>>;
  disabledTools?: readonly ToolName[];
}

const EXAM_TOOL_NAME_SET: ReadonlySet<ToolName> = new Set(EXAM_TOOL_NAMES);
const DEFAULT_DRAIN_TIMEOUT_MS = 3000;

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
  private readonly drainTimeoutMs: number;
  private readonly logger: (message: string) => void;
  private readonly disabledTools: ReadonlySet<ToolName>;
  private refusalActive = false;

  constructor(
    ctx: ModelContextLike,
    engine: EngineFacade,
    options?: ToolRegistryOptions,
  ) {
    this.ctx = ctx;
    this.revocationMode = options?.revocationMode ?? 'deregister';
    this.drainTimeoutMs = options?.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
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
    const desired = desiredToolNames(snapshot, this.revocationMode);
    for (const name of this.disabledTools) {
      desired.delete(name);
    }
    this.refusalActive =
      this.revocationMode === 'refusal' && snapshot.phase === 'exam';

    for (const name of ALL_TOOL_NAMES) {
      if (!desired.has(name)) {
        continue;
      }
      const pending = this.pendingRevocations.get(name);
      if (pending !== undefined) {
        await pending;
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
      this.ctx.registerTool(descriptor, { signal: controller.signal });
    }

    const revocations: Promise<void>[] = [];
    for (const name of ALL_TOOL_NAMES) {
      if (!desired.has(name) && this.controllers.has(name)) {
        revocations.push(this.revokeTool(name));
      }
    }
    await Promise.all(revocations);
  }

  getRegisteredNames(): ToolName[] {
    return ALL_TOOL_NAMES.filter((name) => this.controllers.has(name));
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
      let warnId: ReturnType<typeof setTimeout> | undefined;
      warnId = setTimeout(() => {
        this.logger(
          `Tool ${name} drain exceeded ${this.drainTimeoutMs}ms; still waiting for in-flight executions to settle before abort`,
        );
      }, this.drainTimeoutMs);
      try {
        await this.whenDrained(name);
      } finally {
        if (warnId !== undefined) {
          clearTimeout(warnId);
        }
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
      execute: async (input: unknown): Promise<ToolResponse> => {
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
