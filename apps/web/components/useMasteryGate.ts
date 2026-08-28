"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { NextAction, QuestionPublic, RubricScores } from "@learn/mastery-gate/schema";
import { DEFAULT_SCORES } from "../lib/content";
import {
  getSharedMasteryStack,
  registrySnapshot,
  subscribeEngineMutations,
  subscribeRuntimeDetected,
  wouldRegisterToolNames,
  type MasteryStack,
} from "../lib/masteryStack";
import { syncRegistryRoster } from "../lib/rosterSync";
import type { ToolRosterEntry } from "../lib/types";
import { useToolRosterHighlights } from "./ToolRoster";

export type UiPhase = "lesson" | "practice" | "remediation";

export type LearnerView = {
  scores: RubricScores;
  misconceptionFires: Record<string, number>;
  gatePassed: boolean;
  attemptCount: number;
};

export interface MasteryGateView {
  stack: MasteryStack;
  learner: LearnerView;
  question: QuestionPublic | null;
  nextAction: NextAction | "continue" | null;
  setNextAction: Dispatch<SetStateAction<NextAction | "continue" | null>>;
  uiPhase: UiPhase;
  practiceStarted: boolean;
  beginPractice: () => void;
  enterRemediation: () => void;
  resetSession: () => void;
  refresh: () => void;
  rosterTools: ToolRosterEntry[];
  rosterNames: string[];
  syncError: string | null;
  flashes: Record<string, "register" | "revoke">;
  agentDetected: boolean;
  storageDegraded: boolean;
}

export function useMasteryGate(): MasteryGateView {
  const [stack, setStack] = useState<MasteryStack | null>(null);
  const [learner, setLearner] = useState<LearnerView>({
    scores: DEFAULT_SCORES,
    misconceptionFires: {},
    gatePassed: false,
    attemptCount: 0,
  });
  const [question, setQuestion] = useState<QuestionPublic | null>(null);
  const [uiPhase, setUiPhase] = useState<UiPhase>("lesson");
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [rosterNames, setRosterNames] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<NextAction | "continue" | null>(
    null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [runtimeTick, setRuntimeTick] = useState(0);
  const { flashes, flash } = useToolRosterHighlights();

  const stackRef = useRef<MasteryStack | null>(null);
  const uiPhaseRef = useRef<UiPhase>(uiPhase);
  const practiceStartedRef = useRef(practiceStarted);
  const rosterNamesRef = useRef<string[]>(rosterNames);
  const handleRosterNamesRef = useRef<(next: string[]) => void>(() => {});

  uiPhaseRef.current = uiPhase;
  practiceStartedRef.current = practiceStarted;
  rosterNamesRef.current = rosterNames;

  const handleRosterNames = useCallback(
    (next: string[]) => {
      const previous = rosterNamesRef.current;
      const previousSet = new Set(previous);
      const nextSet = new Set(next);
      for (const name of next) {
        if (!previousSet.has(name)) {
          flash(name, "register");
        }
      }
      for (const name of previous) {
        if (!nextSet.has(name)) {
          flash(name, "revoke");
        }
      }
      rosterNamesRef.current = next;
      setRosterNames(next);
    },
    [flash],
  );
  handleRosterNamesRef.current = handleRosterNames;

  const refreshFromEngine = useCallback(() => {
    const s = stackRef.current;
    if (!s) {
      return;
    }
    const state = s.facade.getLearnerState();
    setLearner({
      scores: state.scores,
      misconceptionFires: state.misconceptionFires,
      gatePassed: state.gatePassed,
      attemptCount: state.attemptCount,
    });
    setQuestion(s.facade.getCurrentQuestion());
    setNextAction(s.facade.requestNextAction());
    // Practice is "started" the moment the shared ledger holds an attempt —
    // whether it came from a page button on another route or from an agent
    // driving submit_answer. Route changes must not re-gate an in-flight
    // session behind "Begin practice".
    if (state.attemptCount > 0 && !practiceStartedRef.current) {
      practiceStartedRef.current = true;
      setPracticeStarted(true);
      if (uiPhaseRef.current === "lesson") {
        uiPhaseRef.current = "practice";
        setUiPhase("practice");
      }
    }
    const phase = practiceStartedRef.current ? uiPhaseRef.current : "lesson";
    const snapshot = registrySnapshot({
      phase,
      gatePassed: state.gatePassed,
      misconceptionFires: state.misconceptionFires,
    });
    if (s.registry) {
      void syncRegistryRoster(s.registry, snapshot, {
        onNames: (names) => {
          handleRosterNamesRef.current(names);
        },
        onSyncError: (notice) => {
          setSyncError(notice);
        },
        onSyncOk: () => {
          setSyncError(null);
        },
        afterSync: () => {
          s.watcher?.refresh();
        },
      });
    } else {
      handleRosterNamesRef.current(wouldRegisterToolNames(snapshot));
    }
  }, []);

  useEffect(() => {
    const s = getSharedMasteryStack();
    stackRef.current = s;
    setStack(s);
    const unsubscribe = subscribeEngineMutations(() => {
      refreshFromEngine();
    });
    let off: (() => void) | undefined;
    const wireWatcher = () => {
      if (!s.watcher) return;
      try {
        off?.();
        off = s.watcher.onChange((names) => {
          handleRosterNamesRef.current(names);
        });
        s.watcher.start();
      } catch (error) {
        console.error("[mastery-gate] watcher wiring failed", error);
      }
    };
    wireWatcher();
    // ChatGPT injects document.modelContext on its own schedule — when the
    // runtime shows up late, bind the freshly created registry/watcher and
    // resync so the roster flips from "intended" to live.
    const offRuntime = subscribeRuntimeDetected(() => {
      setRuntimeTick((tick) => tick + 1);
      wireWatcher();
      refreshFromEngine();
    });
    refreshFromEngine();
    return () => {
      unsubscribe();
      offRuntime();
      off?.();
      s.watcher?.stop();
    };
  }, [refreshFromEngine]);

  const beginPractice = useCallback(() => {
    practiceStartedRef.current = true;
    uiPhaseRef.current = "practice";
    setPracticeStarted(true);
    setUiPhase("practice");
    refreshFromEngine();
  }, [refreshFromEngine]);

  const enterRemediation = useCallback(() => {
    uiPhaseRef.current = "remediation";
    setUiPhase("remediation");
    refreshFromEngine();
  }, [refreshFromEngine]);

  const resetSession = useCallback(() => {
    const currentStack = stackRef.current;
    if (!currentStack) {
      return;
    }
    currentStack.engine.reset();
    practiceStartedRef.current = false;
    uiPhaseRef.current = "lesson";
    setPracticeStarted(false);
    setUiPhase("lesson");
    refreshFromEngine();
  }, [refreshFromEngine]);

  const rosterTools: ToolRosterEntry[] = rosterNames.map((name) => {
    const meta = stack?.toolMeta[name];
    return {
      name,
      description: meta?.description ?? "",
      dynamic: meta?.dynamic ?? false,
    };
  });

  const agentDetected = stack?.agentRuntimeDetected === true;
  const storageDegraded = stack?.storageDegraded === true;
  void runtimeTick;

  return {
    stack: stack as MasteryStack,
    learner,
    question,
    nextAction,
    setNextAction,
    uiPhase,
    practiceStarted,
    beginPractice,
    enterRemediation,
    resetSession,
    refresh: refreshFromEngine,
    rosterTools,
    rosterNames,
    syncError,
    flashes,
    agentDetected,
    storageDegraded,
  };
}
