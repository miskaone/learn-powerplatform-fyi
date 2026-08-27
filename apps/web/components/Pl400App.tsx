"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NextAction, QuestionPublic, RubricScores } from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { scrollToSection } from "../lib/anchor";
import {
  DEFAULT_SCORES,
  DEMO_MASTERY_QUOTE,
  lessonSections,
  manifest,
} from "../lib/content";
import { flipPreviewScenario } from "../lib/flipPreview";
import {
  getSharedMasteryStack,
  registrySnapshot,
  subscribeEngineMutations,
  wouldRegisterToolNames,
  type MasteryStack,
} from "../lib/masteryStack";
import { syncRegistryRoster } from "../lib/rosterSync";
import type { ToolRosterEntry, UiVerdict } from "../lib/types";
import { ExamModePanel } from "./ExamModePanel";
import { FlipConditionDrill } from "./FlipConditionDrill";
import { NextActionButton } from "./NextActionButton";
import { QuizCard } from "./QuizCard";
import { RubricPanel } from "./RubricPanel";
import { ToolRoster, useToolRosterHighlights } from "./ToolRoster";

const NEXT_ACTIONS: readonly NextAction[] = [
  "hint",
  "review",
  "coach",
  "go_deeper",
  "advance",
];

const MASTERY_EVIDENCE = {
  score: 3 as const,
  evidenceQuote: DEMO_MASTERY_QUOTE,
};

type UiPhase = "lesson" | "practice" | "remediation";

type LearnerView = {
  scores: RubricScores;
  misconceptionFires: Record<string, number>;
  gatePassed: boolean;
  attemptCount: number;
};

function isNextAction(value: NextAction | "continue" | null): value is NextAction {
  return (NEXT_ACTIONS as readonly string[]).includes(value ?? "");
}

function noop(): void {}

function hintRefusalMessage(refusal: string): string {
  if (refusal === "tier2-requires-attempt") {
    return "Hint ladder: tier-2 refuses before a genuine first attempt — submit an answer first.";
  }
  if (refusal === "ladder-exhausted") {
    return "Hint ladder exhausted for this question.";
  }
  return refusal;
}

export function Pl400App() {
  const [stack, setStack] = useState<MasteryStack | null>(null);
  const [learner, setLearner] = useState<LearnerView>({
    scores: DEFAULT_SCORES,
    misconceptionFires: {},
    gatePassed: false,
    attemptCount: 0,
  });
  const [question, setQuestion] = useState<QuestionPublic | null>(null);
  const [verdict, setVerdict] = useState<UiVerdict | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintRefusal, setHintRefusal] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<UiPhase>("lesson");
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [rosterNames, setRosterNames] = useState<string[]>([]);
  const [advancedBanner, setAdvancedBanner] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction | "continue" | null>(
    null,
  );
  const [rubricNotice, setRubricNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
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
    if (s.watcher) {
      off = s.watcher.onChange((names) => {
        handleRosterNamesRef.current(names);
      });
      s.watcher.start();
    }
    refreshFromEngine();
    return () => {
      unsubscribe();
      off?.();
      s.watcher?.stop();
    };
  }, [refreshFromEngine]);

  function handleBeginPractice() {
    practiceStartedRef.current = true;
    uiPhaseRef.current = "practice";
    setPracticeStarted(true);
    setUiPhase("practice");
    refreshFromEngine();
  }

  function handleSubmitAnswer(optionId: string) {
    const current = question;
    const currentStack = stackRef.current;
    if (!current || !currentStack) {
      return;
    }
    try {
      const result = currentStack.facade.submitAnswer(current.id, optionId);
      const brief = result.misconceptionId
        ? currentStack.facade.getMisconceptionBrief(result.misconceptionId)
        : null;
      setVerdict({
        questionId: result.questionId,
        correct: result.correct,
        misconceptionId: result.misconceptionId,
        misconceptionName: result.misconceptionId
          ? (brief?.name ?? null)
          : null,
        attemptNumber: result.attemptNumber,
        attemptsRemaining: result.attemptsRemaining,
      });
      setHint(null);
      setHintRefusal(null);
    } catch (error) {
      if (error instanceof RangeError) {
        refreshFromEngine();
        return;
      }
      throw error;
    }
  }

  function handleHint() {
    const current = question;
    const currentStack = stackRef.current;
    if (!current || !currentStack) {
      return;
    }
    const result = currentStack.facade.getHint(current.id);
    if (result.granted && result.hint) {
      setHint(result.hint);
      setHintRefusal(null);
      return;
    }
    setHint(null);
    setHintRefusal(hintRefusalMessage(result.refusal ?? "hint refused"));
  }

  function handleNextAction(action: NextAction) {
    const currentStack = stackRef.current;
    if (!currentStack) {
      return;
    }
    if (action === "hint") {
      handleHint();
      return;
    }
    if (action === "review" || action === "coach") {
      const anchor =
        (verdict?.misconceptionId
          ? currentStack.facade.getMisconceptionBrief(verdict.misconceptionId)
              ?.anchor
          : undefined) ?? lessonSections[0].id;
      scrollToSection(anchor);
      uiPhaseRef.current = "remediation";
      setUiPhase("remediation");
      refreshFromEngine();
      return;
    }
    if (action === "go_deeper") {
      setVerdict(null);
      setHint(null);
      setHintRefusal(null);
      refreshFromEngine();
      return;
    }
    if (action === "advance") {
      const result = currentStack.facade.advanceModule();
      if (result.advanced) {
        setAdvancedBanner(true);
      }
    }
  }

  function handleMasterRubric() {
    const currentStack = stackRef.current;
    if (!currentStack) {
      return;
    }
    const verdict = currentStack.facade.scoreRubric({
      recall: MASTERY_EVIDENCE,
      connections: MASTERY_EVIDENCE,
      application: MASTERY_EVIDENCE,
      transfer: MASTERY_EVIDENCE,
    });
    setRubricNotice(
      verdict.accepted
        ? null
        : `Rubric rejected by the engine: ${verdict.rejectionReason ?? "unknown"}`,
    );
  }

  function handleLowConfidence() {
    const currentStack = stackRef.current;
    if (!currentStack) {
      return;
    }
    setNextAction(currentStack.facade.requestNextAction("low"));
  }

  function handleResetSession() {
    const currentStack = stackRef.current;
    if (!currentStack) {
      return;
    }
    currentStack.engine.reset();
    setVerdict(null);
    setHint(null);
    setHintRefusal(null);
    setRubricNotice(null);
    practiceStartedRef.current = false;
    uiPhaseRef.current = "lesson";
    setPracticeStarted(false);
    setUiPhase("lesson");
    setAdvancedBanner(false);
    refreshFromEngine();
  }

  const rosterTools: ToolRosterEntry[] = rosterNames.map((name) => {
    const meta = stack?.toolMeta[name];
    return {
      name,
      description: meta?.description ?? "",
      dynamic: meta?.dynamic ?? false,
    };
  });

  const verdictForQuestion =
    verdict && question && verdict.questionId === question.id ? verdict : null;
  const showCorrectAdvance =
    verdict !== null &&
    verdict.correct &&
    verdict.questionId !== (question ? question.id : null);
  const questionIndex = question
    ? manifest.questions.findIndex((item) => item.id === question.id)
    : -1;
  const questionNumber = questionIndex >= 0 ? questionIndex + 1 : 1;
  const questionCount = manifest.questions.length;
  const agentDetected = stack?.agentRuntimeDetected === true;

  return (
    <div className="pl400">
      <header className="pl400-header">
        <h1>PL-400 — Mastery Gate</h1>
        <p>
          Dataverse plugin execution: the pipeline, images, and the difference
          between a veto and a side effect. The site grades; the agent coaches
          through the tools the roster currently permits.
        </p>
        <span className="pl400-phase">phase: {uiPhase}</span>
      </header>

      <div className="pl400-layout">
        <div className="pl400-main">
          {lessonSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="pl400-card pl400-lesson-section"
            >
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </section>
          ))}

          <section id="practice" className="pl400-card">
            <h2>Practice</h2>
            <p className="muted">
              One question at a time. A miss names the misconception — never the
              correct option.
            </p>
            {!practiceStarted ? (
              <button
                type="button"
                className="pl400-btn pl400-btn-primary"
                onClick={handleBeginPractice}
              >
                Begin practice
              </button>
            ) : null}
            <div className="pl400-btn-row">
              <button
                type="button"
                className="pl400-btn pl400-btn-muted"
                onClick={() => scrollToSection(lessonSections[0].id)}
              >
                Jump to remediation section
              </button>
            </div>
            {showCorrectAdvance ? (
              <div className="pl400-banner pl400-banner-success" role="status">
                {question
                  ? "Correct — next question loaded."
                  : "Correct — practice items complete."}
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={handleLowConfidence}
                >
                  I wasn&apos;t sure — go deeper
                </button>
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={() => {
                    setVerdict(null);
                    setHint(null);
                  }}
                >
                  Clear
                </button>
              </div>
            ) : null}
            {practiceStarted && question ? (
              <div style={{ marginTop: "1rem" }}>
                <QuizCard
                  question={question}
                  questionNumber={questionNumber}
                  questionCount={questionCount}
                  verdict={verdictForQuestion}
                  onSubmit={handleSubmitAnswer}
                  onHint={handleHint}
                  hint={hint}
                />
              </div>
            ) : null}
            {hintRefusal ? (
              <div className="pl400-banner pl400-banner-info" role="status">
                {hintRefusal}
              </div>
            ) : null}
            {practiceStarted && question === null ? (
              <p className="muted">Practice items complete.</p>
            ) : null}
            {isNextAction(nextAction) ? (
              <NextActionButton
                action={nextAction}
                onActivate={handleNextAction}
              />
            ) : null}
            {advancedBanner ? (
              <div className="pl400-banner pl400-banner-success" role="status">
                Module complete.
              </div>
            ) : null}
            <div className="pl400-demo">
              <span className="pl400-demo-label">Agent-less controls</span>
              <p className="muted">
                These buttons drive the same engine facade the WebMCP tools call
                — nothing here bypasses the gate.
              </p>
              <div className="pl400-btn-row">
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={handleMasterRubric}
                >
                  Score rubric at mastery (demo)
                </button>
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={handleResetSession}
                >
                  Reset session
                </button>
              </div>
              {rubricNotice ? (
                <div className="pl400-banner pl400-banner-info" role="status">
                  {rubricNotice}
                </div>
              ) : null}
              {stack?.storageDegraded ? (
                <p className="muted">
                  localStorage unavailable — progress is in-memory only.
                </p>
              ) : null}
            </div>
          </section>

          <section id="flip-drill">
            <h2>Flip-Condition drill</h2>
            <span className="pl400-phase">
              inactive — engine drill state machine pending; drill tools not
              registered
            </span>
            <fieldset
              disabled
              className="drill-disabled"
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: 0 }}
            >
              <FlipConditionDrill scenario={flipPreviewScenario} />
            </fieldset>
          </section>

          <section id="exam">
            <h2>Exam</h2>
            <span className="pl400-phase">
              inactive — exam lifecycle pending; exam tools not registered
            </span>
            <fieldset
              disabled
              className="drill-disabled"
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: 0 }}
            >
              <ExamModePanel
                active={false}
                secondsRemaining={0}
                lockedTools={[]}
                onStart={noop}
                onSubmit={noop}
                submitted={false}
              />
            </fieldset>
          </section>

          <section id="debrief" className="pl400-card">
            <h2>Debrief</h2>
            <p>Inactive — the debrief unlocks after Exam Mode ships.</p>
          </section>
        </div>

        <aside className="pl400-aside">
          <ToolRoster
            tools={rosterTools}
            flashes={flashes}
            errorNotice={syncError ?? undefined}
            modeLabel={
              agentDetected
                ? "agent runtime: modelContext detected (getTools polling)"
                : "no agent runtime detected"
            }
            notice={
              agentDetected
                ? undefined
                : "No agent runtime detected — page buttons drive the same engine. Listing the tools that WOULD be registered."
            }
          />
          <RubricPanel scores={learner.scores} />
        </aside>
      </div>
    </div>
  );
}

export default Pl400App;
