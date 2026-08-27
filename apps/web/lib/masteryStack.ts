import { LocalStorageAdapter, MasteryEngine } from "@learn/mastery-gate/engine";
import {
  MasteryEngineFacade,
  ToolRegistry,
  ToolSurfaceWatcher,
  createToolset,
  desiredToolNames,
  resolveModelContext,
  DYNAMIC_TOOL_NAMES,
  STATIC_TOOL_NAMES,
  type EngineFacade,
  type RegistrySnapshot,
  type ToolName,
} from "@learn/mastery-gate/webmcp";
import { scrollToSection } from "./anchor";
import { lessonSections, manifest } from "./content";

/**
 * Drill, exam, and debrief tools stay off the live surface until the engine
 * has state machines for those phases; they must never register.
 */
export const QUARANTINED_TOOLS: readonly ToolName[] = [
  "mutate_assumption",
  "commit_prediction",
  "reveal_outcome",
  "start_exam",
  "get_exam_status",
  "submit_exam",
  "get_exam_debrief",
  "compose_debrief",
  "get_narration_script",
  "advance_segment",
];

class NotifyingFacade implements EngineFacade {
  constructor(
    private readonly inner: EngineFacade,
    private readonly notify: () => void,
  ) {}

  getLearnerState() {
    return this.inner.getLearnerState();
  }

  getCurrentContext() {
    return this.inner.getCurrentContext();
  }

  getCurrentQuestion() {
    return this.inner.getCurrentQuestion();
  }

  submitAnswer(questionId: string, optionId: string) {
    const result = this.inner.submitAnswer(questionId, optionId);
    this.notify();
    return result;
  }

  getHint(questionId: string) {
    const result = this.inner.getHint(questionId);
    this.notify();
    return result;
  }

  requestNextAction(confidence?: "low" | "high") {
    return this.inner.requestNextAction(confidence);
  }

  prescribeDrill() {
    return this.inner.prescribeDrill();
  }

  scoreRubric(submission: Parameters<EngineFacade["scoreRubric"]>[0]) {
    const result = this.inner.scoreRubric(submission);
    this.notify();
    return result;
  }

  logCoachingNote(note: string) {
    this.inner.logCoachingNote(note);
    this.notify();
  }

  navigateToAnchor(anchor: string) {
    return this.inner.navigateToAnchor(anchor);
  }

  getMisconceptionBrief(misconceptionId: string) {
    return this.inner.getMisconceptionBrief(misconceptionId);
  }

  mutateAssumption(scenarioId: string, assumptionId: string) {
    return this.inner.mutateAssumption(scenarioId, assumptionId);
  }

  commitPrediction(scenarioId: string, prediction: string, reason: string) {
    return this.inner.commitPrediction(scenarioId, prediction, reason);
  }

  revealOutcome(scenarioId: string) {
    return this.inner.revealOutcome(scenarioId);
  }

  startExam() {
    return this.inner.startExam();
  }

  getExamStatus() {
    return this.inner.getExamStatus();
  }

  submitExam() {
    return this.inner.submitExam();
  }

  getExamDebrief() {
    return this.inner.getExamDebrief();
  }

  advanceModule() {
    const result = this.inner.advanceModule();
    this.notify();
    return result;
  }

  getFiredMisconceptionIds() {
    return this.inner.getFiredMisconceptionIds();
  }

  composeDebrief(segments: Parameters<EngineFacade["composeDebrief"]>[0]) {
    return this.inner.composeDebrief(segments);
  }

  getNarrationScript() {
    return this.inner.getNarrationScript();
  }

  advanceSegment(segmentId: string) {
    return this.inner.advanceSegment(segmentId);
  }
}

export interface MasteryStack {
  engine: MasteryEngine;
  facade: EngineFacade;
  registry: ToolRegistry | null;
  watcher: ToolSurfaceWatcher | null;
  agentRuntimeDetected: boolean;
  toolMeta: Record<string, { description: string; dynamic: boolean }>;
  /** Live view of the adapter's degradation flag — flips mid-session on quota/ITP failures. */
  readonly storageDegraded: boolean;
}

export function createMasteryStack(onEngineMutation: () => void): MasteryStack {
  const adapter = new LocalStorageAdapter();
  const engine = new MasteryEngine(manifest, adapter);
  const inner = new MasteryEngineFacade(engine, manifest, {
    navigate: (anchor) => scrollToSection(anchor),
    evidenceCorpus: lessonSections.flatMap((section) => [
      section.title,
      ...section.body,
    ]),
  });
  const facade = new NotifyingFacade(inner, onEngineMutation);
  const ctx = resolveModelContext();
  const registry = ctx
    ? new ToolRegistry(ctx, facade, { disabledTools: QUARANTINED_TOOLS })
    : null;
  const watcher = ctx ? new ToolSurfaceWatcher(ctx) : null;
  const toolset = createToolset(facade);
  const toolMeta: Record<string, { description: string; dynamic: boolean }> = {};
  for (const name of Object.keys(toolset)) {
    const descriptor = toolset[name as ToolName];
    toolMeta[name] = {
      description: descriptor.description,
      dynamic: (DYNAMIC_TOOL_NAMES as readonly string[]).includes(name),
    };
  }
  return {
    engine,
    facade,
    registry,
    watcher,
    agentRuntimeDetected: ctx !== null,
    toolMeta,
    // Getter, not a snapshot: degradation that starts mid-session (quota,
    // Safari ITP eviction) must surface on the next render.
    get storageDegraded(): boolean {
      return adapter.isDegraded;
    },
  };
}

/** Drill/exam/debrief phases are quarantined so the UI never feeds them to sync. */
export function registrySnapshot(input: {
  phase: "lesson" | "practice" | "remediation";
  gatePassed: boolean;
  misconceptionFires: Record<string, number>;
}): RegistrySnapshot {
  return {
    phase: input.phase,
    gatePassed: input.gatePassed,
    repeatedMisconceptionIds: Object.keys(input.misconceptionFires).filter(
      (id) => (input.misconceptionFires[id] ?? 0) >= 2,
    ),
    predictionCommitted: false,
    examSubmitted: false,
    moduleComplete: false,
  };
}

export function wouldRegisterToolNames(snapshot: RegistrySnapshot): ToolName[] {
  const desired = desiredToolNames(snapshot, "deregister");
  const allowed = new Set(
    [...desired].filter((name) => !QUARANTINED_TOOLS.includes(name)),
  );
  return [...STATIC_TOOL_NAMES, ...DYNAMIC_TOOL_NAMES].filter((name) =>
    allowed.has(name),
  );
}

let sharedStack: MasteryStack | null = null;
const mutationListeners = new Set<() => void>();

/** One stack per page lifetime — safe under React StrictMode double-mount. */
export function getSharedMasteryStack(): MasteryStack {
  if (sharedStack === null) {
    sharedStack = createMasteryStack(() => {
      for (const listener of [...mutationListeners]) listener();
    });
  }
  return sharedStack;
}

export function subscribeEngineMutations(listener: () => void): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}
