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
  type ActiveLessonPublic,
  type EngineFacade,
  type RegistrySnapshot,
  type ToolName,
} from "@learn/mastery-gate/webmcp";
import { navigateToAnchor } from "./anchor";
import { lessonSections, manifest } from "./content";
import { getLessonIndexEntry, lessonSectionAnchors } from "./lessonIndex";
import { NotifyingFacade } from "./notifyingFacade";

/**
 * Debrief tools stay off the live surface until the Mastery Debrief UI
 * graft lands; they must never register. Drill and exam tools are LIVE —
 * their engine state machines ship, and the registry gates them by phase
 * (drill tools only while a drill is active, exam tools only in exam mode,
 * reveal_outcome only after commit_prediction).
 */
export const QUARANTINED_TOOLS: readonly ToolName[] = [
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
  setActiveLesson(slug: string | null): void;
  getActiveLessonSlug(): string | null;
  /** Live read of tools whose revocation drain has exceeded the warn threshold. */
  getStuckRevocations(): string[];
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
  let activeLesson: (ActiveLessonPublic & { questionIds: readonly string[] }) | null =
    null;
  const inner = new MasteryEngineFacade(engine, manifest, {
    navigate: (anchor) => navigateToAnchor(anchor),
    evidenceCorpus: lessonSections.flatMap((section) => [
      section.title,
      ...section.body,
    ]),
    getActiveLesson: () =>
      activeLesson === null
        ? null
        : {
            slug: activeLesson.slug,
            title: activeLesson.title,
            objectiveId: activeLesson.objectiveId,
            sectionAnchors: [...activeLesson.sectionAnchors],
          },
  });
  const facade = new NotifyingFacade(inner, onEngineMutation);
  const ctx = resolveModelContext(host);
  const registry = ctx
    ? new ToolRegistry(ctx, facade, {
        disabledTools: QUARANTINED_TOOLS,
        onStuckRevocation: () => onEngineMutation(),
      })
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
    setActiveLesson(slug: string | null): void {
      if (slug !== null) {
        const entry = getLessonIndexEntry(slug);
        if (entry === undefined) {
          console.warn(`setActiveLesson: unknown lesson slug "${slug}"`);
        } else {
          if (activeLesson !== null && activeLesson.slug === slug) {
            return;
          }
          activeLesson = {
            slug,
            title: entry.title,
            objectiveId: entry.objectiveId,
            sectionAnchors: lessonSectionAnchors(slug),
            questionIds: entry.questionIds,
          };
          engine.setQuestionScope(entry.questionIds);
          onEngineMutation();
          return;
        }
      }
      if (activeLesson === null && engine.getQuestionScope() === null) {
        return;
      }
      activeLesson = null;
      engine.setQuestionScope(null);
      onEngineMutation();
    },
    getActiveLessonSlug(): string | null {
      return activeLesson === null ? null : activeLesson.slug;
    },
    getStuckRevocations(): string[] {
      return this.registry?.getStuckRevocations() ?? [];
    },
  };

  if (ctx === null) {
    stack.stopRuntimeDetection = startRuntimeDetection(
      stack,
      facade,
      host,
      onRuntimeDetected,
      onEngineMutation,
    );
  }
  return stack;
}

export function lessonProgress(
  stack: MasteryStack,
  questionIds: readonly string[],
): { attempted: number; correct: number; total: number } {
  const progress = stack.engine.getQuestionProgress();
  const scoped = new Set(questionIds);
  let attempted = 0;
  let correct = 0;
  for (const entry of progress) {
    if (!scoped.has(entry.questionId)) {
      continue;
    }
    attempted += 1;
    if (entry.correct === true) {
      correct += 1;
    }
  }
  return { attempted, correct, total: questionIds.length };
}

function startRuntimeDetection(
  stack: MasteryStack,
  facade: EngineFacade,
  host: Parameters<typeof resolveModelContext>[0],
  onRuntimeDetected: (() => void) | undefined,
  onEngineMutation: () => void,
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
      onStuckRevocation: () => onEngineMutation(),
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
 * With a facade supplied the snapshot reports engine truth (drill/exam/
 * debrief phase, predictionCommitted, examSubmitted, moduleComplete); the
 * input object only fills the UI-owned lesson/practice/remediation phase.
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
