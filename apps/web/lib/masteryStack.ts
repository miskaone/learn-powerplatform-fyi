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
import { NotifyingFacade } from "./notifyingFacade";

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

export interface MasteryStack {
  engine: MasteryEngine;
  facade: EngineFacade;
  registry: ToolRegistry | null;
  watcher: ToolSurfaceWatcher | null;
  agentRuntimeDetected: boolean;
  toolMeta: Record<string, { description: string; dynamic: boolean }>;
  /** Live view of the adapter's degradation flag — flips mid-session on quota/ITP failures. */
  readonly storageDegraded: boolean;
  /** Stops the late-binding runtime detection loop, if one is running. */
  stopRuntimeDetection: () => void;
}

/**
 * ChatGPT's in-app browser injects `document.modelContext` at a time of its
 * own choosing — sometimes after this app has hydrated. A one-shot
 * `resolveModelContext()` at mount therefore races the injection and can lose
 * permanently (observed live 2026-08-27: roster showed intended tools, agent
 * saw none). Detection must keep looking until the runtime appears.
 */
const RUNTIME_POLL_MS = 500;
const RUNTIME_POLL_MAX_ATTEMPTS = 240; // 2 minutes, then give up quietly

export function createMasteryStack(
  onEngineMutation: () => void,
  onRuntimeDetected?: () => void,
  host?: Parameters<typeof resolveModelContext>[0],
): MasteryStack {
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
  const ctx = resolveModelContext(host);
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
  const stack: MasteryStack = {
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
    stopRuntimeDetection: () => {},
  };

  if (ctx === null) {
    stack.stopRuntimeDetection = startRuntimeDetection(stack, facade, host, onRuntimeDetected);
  }
  return stack;
}

function startRuntimeDetection(
  stack: MasteryStack,
  facade: EngineFacade,
  host: Parameters<typeof resolveModelContext>[0],
  onRuntimeDetected?: () => void,
): () => void {
  let attempts = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tryBind = (): boolean => {
    if (stopped || stack.agentRuntimeDetected) {
      return true;
    }
    const late = resolveModelContext(host);
    if (late === null) {
      return false;
    }
    stack.registry = new ToolRegistry(late, facade, {
      disabledTools: QUARANTINED_TOOLS,
    });
    stack.watcher = new ToolSurfaceWatcher(late);
    stack.agentRuntimeDetected = true;
    stop();
    onRuntimeDetected?.();
    return true;
  };

  const onWake = () => {
    void tryBind();
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (timer !== null) clearInterval(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onWake);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onWake);
    }
  }

  timer = setInterval(() => {
    attempts += 1;
    if (tryBind() || attempts >= RUNTIME_POLL_MAX_ATTEMPTS) {
      stop();
    }
  }, RUNTIME_POLL_MS);
  // Injection often lands when the tab gains attention — check immediately then.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onWake);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onWake);
  }
  return stop;
}

/**
 * Drill/exam/debrief tools stay off the live surface until the host opts
 * them in (QUARANTINED_TOOLS unchanged in this slice), but the snapshot
 * itself is now truthful when a facade is supplied.
 */
export function registrySnapshot(
  input: {
    phase: "lesson" | "practice" | "remediation";
    gatePassed: boolean;
    misconceptionFires: Record<string, number>;
  },
  facade?: EngineFacade,
): RegistrySnapshot {
  if (facade) {
    const s = facade.getRegistrySnapshot();
    return {
      phase:
        s.phase === "drill" || s.phase === "exam" || s.phase === "debrief"
          ? s.phase
          : input.phase,
      gatePassed: s.gatePassed,
      repeatedMisconceptionIds: s.repeatedMisconceptionIds,
      predictionCommitted: s.predictionCommitted,
      examSubmitted: s.examSubmitted,
      moduleComplete: s.moduleComplete,
    };
  }
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
const runtimeListeners = new Set<() => void>();

/** One stack per page lifetime — safe under React StrictMode double-mount. */
export function getSharedMasteryStack(): MasteryStack {
  if (sharedStack === null) {
    sharedStack = createMasteryStack(
      () => {
        for (const listener of [...mutationListeners]) listener();
      },
      () => {
        for (const listener of [...runtimeListeners]) listener();
      },
    );
  }
  return sharedStack;
}

/** Fires once if the WebMCP runtime appears after the stack was created. */
export function subscribeRuntimeDetected(listener: () => void): () => void {
  runtimeListeners.add(listener);
  return () => {
    runtimeListeners.delete(listener);
  };
}

export function subscribeEngineMutations(listener: () => void): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}
