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

const EXAM_TOOL_NAME_SET: ReadonlySet<ToolName> = new Set(EXAM_TOOL_NAMES);

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
  private refusalActive = false;

  constructor(
    ctx: ModelContextLike,
    engine: EngineFacade,
    options?: { revocationMode?: RevocationMode },
  ) {
    this.ctx = ctx;
    this.revocationMode = options?.revocationMode ?? 'deregister';
    const toolset = createToolset(engine);
    for (const name of ALL_TOOL_NAMES) {
      const original = toolset[name];
      this.descriptors.set(
        name,
        EXAM_TOOL_NAME_SET.has(name) ? original : this.guard(original),
      );
    }
  }

  sync(snapshot: RegistrySnapshot): void {
    const desired = desiredToolNames(snapshot, this.revocationMode);
    this.refusalActive =
      this.revocationMode === 'refusal' && snapshot.phase === 'exam';

    for (const name of ALL_TOOL_NAMES) {
      const shouldHave = desired.has(name);
      const isRegistered = this.controllers.has(name);
      if (shouldHave && !isRegistered) {
        const descriptor = this.descriptors.get(name);
        if (descriptor === undefined) {
          continue;
        }
        const controller = new AbortController();
        this.controllers.set(name, controller);
        this.ctx.registerTool(descriptor, { signal: controller.signal });
      } else if (!shouldHave && isRegistered) {
        const controller = this.controllers.get(name);
        this.controllers.delete(name);
        controller?.abort();
      }
    }
  }

  getRegisteredNames(): ToolName[] {
    return ALL_TOOL_NAMES.filter((name) => this.controllers.has(name));
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
