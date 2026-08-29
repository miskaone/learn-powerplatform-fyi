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
  type LessonBriefPublic,
  type RegistrySnapshot,
  type ToolDescriptor,
  type ToolName,
} from "@learn/mastery-gate/webmcp";
import { navigateToAnchor } from "./anchor";
import { applyFocusPreset } from "./focus";
import { lessonSections, manifest } from "./content";
import { getLessonIndexEntry, lessonSectionAnchorEntries } from "./lessonIndex";
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
  setActiveLesson(slug: string | null, brief?: LessonBriefPublic | null): void;
  /** Replaces the active lesson's brief in place (no question-scope churn). Ignored unless the slug matches the active lesson AND the brief's own slug. */
  setLessonBrief(slug: string, brief: LessonBriefPublic | null): void;
  getActiveLessonSlug(): string | null;
  /** Live read of tools whose revocation drain has exceeded the warn threshold. */
  getStuckRevocations(): string[];
  /**
   * The one live toolset instance — the registry registers wrapped views of
   * these exact descriptors (shared engine state, shared redaction mappers).
   * ENGINE-GUARD INVARIANT: raw descriptors carry no registry-layer guards
   * (drain refusal, refusal-mode exam guard). Every consequential tool MUST
   * therefore refuse inside the engine/adapter itself (gate-not-passed,
   * exam-in-progress, structural redaction) — never rely on registry-layer
   * guards alone, because agent-less surfaces execute without a registry.
   */
  getToolset(): Record<ToolName, ToolDescriptor>;
  /**
   * Descriptors an in-app surface should INVOKE. With an agent runtime
   * bound these are the registry-wrapped descriptors — the identical guard
   * layer (mid-drain `tool-revoked` refusal, refusal-mode exam guard) an
   * agent passes through. Agent-less, no registry exists and the raw
   * descriptors are returned; safety then rests entirely on the
   * engine-guard invariant documented on getToolset().
   */
  getInvocableToolset(): Record<ToolName, ToolDescriptor>;
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

function resolvedBriefForSlug(
  slug: string,
  brief: LessonBriefPublic | null | undefined,
): LessonBriefPublic | null | undefined {
  if (brief === undefined || brief === null) {
    return brief;
  }
  if (brief.slug !== slug) {
    console.warn(
      `setActiveLesson: brief slug "${brief.slug}" does not match lesson "${slug}" — brief ignored`,
    );
    return null;
  }
  return brief;
}

function copyBrief(brief: LessonBriefPublic): LessonBriefPublic {
  return {
    id: brief.id,
    slug: brief.slug,
    title: brief.title,
    topicTitle: brief.topicTitle,
    objectiveId: brief.objectiveId,
    heroEpigraph: brief.heroEpigraph,
    governingRule: brief.governingRule,
    examClue: brief.examClue,
    mnemonic: brief.mnemonic,
    scenarioPrompt: brief.scenarioPrompt,
    scenarioOrderItems: [...brief.scenarioOrderItems],
    concepts: brief.concepts.map((concept) => ({
      id: concept.id,
      label: concept.label,
      importance: concept.importance,
      summary: concept.summary,
    })),
    productionNuance: brief.productionNuance.map((line) => line),
    scenarioExpectedAnswer: brief.scenarioExpectedAnswer ?? null,
    distractors: brief.distractors.map((d) => ({
      choice: d.choice,
      whyTempting: d.whyTempting,
      whyWrong: d.whyWrong,
    })),
    visual: {
      type: brief.visual.type,
      title: brief.visual.title,
      steps: brief.visual.steps.map((s) => ({
        label: s.label,
        state: s.state,
        detail: s.detail,
      })),
    },
    drills: {
      recall: brief.drills.recall,
      connections: brief.drills.connections,
      application: brief.drills.application,
      transfer: brief.drills.transfer,
    },
    reflection: brief.reflection.map((line) => line),
    sections: brief.sections.map((section) => ({
      anchor: section.anchor,
      title: section.title,
    })),
    references: brief.references.map((reference) => ({
      label: reference.label,
      url: reference.url,
    })),
  };
}

export function createMasteryStack(
  onEngineMutation: () => void,
  onRuntimeDetected?: () => void,
  host?: Parameters<typeof resolveModelContext>[0],
): MasteryStack {
  const adapter = new LocalStorageAdapter();
  const engine = new MasteryEngine(manifest, adapter);
  let activeLesson:
    | (ActiveLessonPublic & {
        questionIds: readonly string[];
        brief: LessonBriefPublic | null;
      })
    | null = null;
  const inner = new MasteryEngineFacade(engine, manifest, {
    navigate: (anchor) => navigateToAnchor(anchor),
    applyFocus: (preset, anchor) => applyFocusPreset(preset, anchor),
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
            sectionAnchors: activeLesson.sectionAnchors.map((entry) => ({
              anchor: entry.anchor,
              title: entry.title,
            })),
          },
    getLessonBrief: () => {
      const brief = activeLesson?.brief ?? null;
      if (brief === null) {
        return null;
      }
      return {
        id: brief.id,
        slug: brief.slug,
        title: brief.title,
        topicTitle: brief.topicTitle,
        objectiveId: brief.objectiveId,
        heroEpigraph: brief.heroEpigraph,
        governingRule: brief.governingRule,
        examClue: brief.examClue,
        mnemonic: brief.mnemonic,
        scenarioPrompt: brief.scenarioPrompt,
        scenarioOrderItems: [...brief.scenarioOrderItems],
        concepts: brief.concepts.map((concept) => ({
          id: concept.id,
          label: concept.label,
          importance: concept.importance,
          summary: concept.summary,
        })),
        productionNuance: [...brief.productionNuance],
        scenarioExpectedAnswer: brief.scenarioExpectedAnswer ?? null,
        distractors: brief.distractors.map((d) => ({
          choice: d.choice,
          whyTempting: d.whyTempting,
          whyWrong: d.whyWrong,
        })),
        visual: {
          type: brief.visual.type,
          title: brief.visual.title,
          steps: brief.visual.steps.map((s) => ({
            label: s.label,
            state: s.state,
            detail: s.detail,
          })),
        },
        drills: {
          recall: brief.drills.recall,
          connections: brief.drills.connections,
          application: brief.drills.application,
          transfer: brief.drills.transfer,
        },
        reflection: [...brief.reflection],
        sections: brief.sections.map((section) => ({
          anchor: section.anchor,
          title: section.title,
        })),
        references: brief.references.map((reference) => ({
          label: reference.label,
          url: reference.url,
        })),
      };
    },
  });
  const facade = new NotifyingFacade(inner, onEngineMutation);
  const ctx = resolveModelContext(host);
  let sharedToolset = createToolset(facade);
  const toolMeta: Record<string, { description: string; dynamic: boolean }> = {};
  for (const name of Object.keys(sharedToolset)) {
    const descriptor = sharedToolset[name as ToolName];
    toolMeta[name] = {
      description: descriptor.description,
      dynamic: (DYNAMIC_TOOL_NAMES as readonly string[]).includes(name),
    };
  }
  const registry = ctx
    ? new ToolRegistry(ctx, facade, {
        disabledTools: QUARANTINED_TOOLS,
        onStuckRevocation: () => onEngineMutation(),
        toolsetOverride: sharedToolset,
      })
    : null;
  const watcher = ctx ? new ToolSurfaceWatcher(ctx) : null;
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
    setActiveLesson(slug: string | null, brief?: LessonBriefPublic | null): void {
      if (slug !== null) {
        const entry = getLessonIndexEntry(slug);
        if (entry === undefined) {
          console.warn(`setActiveLesson: unknown lesson slug "${slug}"`);
        } else {
          const incoming = resolvedBriefForSlug(slug, brief);
          if (activeLesson !== null && activeLesson.slug === slug) {
            if (incoming !== undefined) {
              activeLesson.brief =
                incoming === null ? null : copyBrief(incoming);
            }
            return;
          }
          activeLesson = {
            slug,
            title: entry.title,
            objectiveId: entry.objectiveId,
            sectionAnchors: lessonSectionAnchorEntries(slug),
            questionIds: entry.questionIds,
            brief: incoming == null ? null : copyBrief(incoming),
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
    setLessonBrief(slug: string, brief: LessonBriefPublic | null): void {
      if (activeLesson === null || activeLesson.slug !== slug) {
        return;
      }
      if (brief !== null && brief.slug !== slug) {
        console.warn(
          `setLessonBrief: brief slug "${brief.slug}" does not match lesson "${slug}" — brief ignored`,
        );
        return;
      }
      activeLesson.brief = brief === null ? null : copyBrief(brief);
    },
    getActiveLessonSlug(): string | null {
      return activeLesson === null ? null : activeLesson.slug;
    },
    getStuckRevocations(): string[] {
      return this.registry?.getStuckRevocations() ?? [];
    },
    getToolset(): Record<ToolName, ToolDescriptor> {
      return sharedToolset;
    },
    getInvocableToolset(): Record<ToolName, ToolDescriptor> {
      const registry = this.registry;
      if (registry === null) {
        return sharedToolset;
      }
      const wrapped = {} as Record<ToolName, ToolDescriptor>;
      for (const name of Object.keys(sharedToolset) as ToolName[]) {
        wrapped[name] =
          registry.getWrappedDescriptor(name) ?? sharedToolset[name];
      }
      return wrapped;
    },
  };

  if (ctx === null) {
    stack.stopRuntimeDetection = startRuntimeDetection(
      stack,
      facade,
      host,
      onRuntimeDetected,
      onEngineMutation,
      {
        getSharedToolset: () => sharedToolset,
        setSharedToolset: (next) => {
          sharedToolset = next;
        },
      },
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
  shared: {
    getSharedToolset: () => Record<ToolName, ToolDescriptor>;
    setSharedToolset: (toolset: Record<ToolName, ToolDescriptor>) => void;
  },
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
    shared.setSharedToolset(createToolset(facade));
    const lateToolset = shared.getSharedToolset();
    stack.registry = new ToolRegistry(late, facade, {
      disabledTools: QUARANTINED_TOOLS,
      onStuckRevocation: () => onEngineMutation(),
      toolsetOverride: lateToolset,
    });
    stack.watcher = new ToolSurfaceWatcher(late);
    // Late binding IS registration time: the registry above just composed
    // its descriptors (incl. the ISC-74 returning-learner suffixes) from the
    // profile as it stands NOW. Rebuild the roster meta from the same state
    // so the on-page descriptions match what actually registered — the meta
    // captured at stack creation could predate profile changes.
    for (const name of Object.keys(lateToolset)) {
      const descriptor = lateToolset[name as ToolName];
      stack.toolMeta[name] = {
        description: descriptor.description,
        dynamic: (DYNAMIC_TOOL_NAMES as readonly string[]).includes(name),
      };
    }
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
