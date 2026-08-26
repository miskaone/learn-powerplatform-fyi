"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AttemptRecord,
  Ledger,
  NextAction,
  RubricDimension,
  RubricScores,
  ToolPhase,
} from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { scrollToSection } from "../lib/anchor";
import {
  dynamicTools,
  flipScenario,
  gradeAnswer,
  initialLedger,
  initialScores,
  lessonSections,
  misconceptionNames,
  publicQuestions,
  questionHints,
  staticTools,
  type GradeVerdict,
  type ToolRosterEntry,
} from "../lib/mockState";
import { DebriefCard } from "./DebriefCard";
import { ExamModePanel } from "./ExamModePanel";
import { FlipConditionDrill } from "./FlipConditionDrill";
import { NextActionButton } from "./NextActionButton";
import { QuizCard } from "./QuizCard";
import { RubricPanel } from "./RubricPanel";
import { ToolRoster, useToolRosterHighlights } from "./ToolRoster";

const EXAM_LOCKED_TOOLS = [
  "get_hint",
  "get_current_question",
  "submit_answer",
  "request_next_action",
  "prescribe_drill",
  "get_misconception_brief",
  "score_rubric",
];

const MISCONCEPTION_SECTION: Record<string, string> = {
  "client-side-enforcement-only": "where-it-executes",
  "sync-plugin-for-everything": "sync-vs-async",
  "pre-image-is-live-data": "images-and-context",
};

const DRILL_BY_DIMENSION: Record<RubricDimension, string> = {
  recall: "Spaced review of pipeline stages",
  connections: "Concept-link walk: images ↔ stages",
  application: "Failure-case rebuild: the silent bypass",
  transfer: "What-if drill: flip one assumption in the credit-limit plugin",
};

const RUBRIC_DIMENSIONS: RubricDimension[] = [
  "recall",
  "connections",
  "application",
  "transfer",
];

const EXAM_SECONDS = 300;
const REVOKE_REMOVE_MS = 1200;

const MASTERED_SCORES: RubricScores = {
  recall: 3,
  connections: 3,
  application: 3,
  transfer: 3,
};

function isGateOpen(scores: RubricScores): boolean {
  return RUBRIC_DIMENSIONS.every((dimension) => scores[dimension] >= 3);
}

function weakestDimension(scores: RubricScores): RubricDimension {
  let weakest: RubricDimension = "recall";
  for (const dimension of RUBRIC_DIMENSIONS) {
    if (scores[dimension] < scores[weakest]) {
      weakest = dimension;
    }
  }
  return weakest;
}

function resolveNextAction(input: {
  verdict: GradeVerdict | null;
  misconceptionFires: Record<string, number>;
  questionIndex: number;
  questionCount: number;
  scores: RubricScores;
}): NextAction | null {
  const onLast = input.questionIndex === input.questionCount - 1;
  const pastEnd = input.questionIndex >= input.questionCount;
  const allDone = pastEnd || (onLast && input.verdict?.correct === true);
  const gateOpen = isGateOpen(input.scores);

  if (allDone && gateOpen) {
    return "advance";
  }
  if (pastEnd) {
    return null;
  }
  if (!input.verdict) {
    return null;
  }
  if (input.verdict.correct) {
    return "go_deeper";
  }

  const fires = input.verdict.misconceptionId
    ? (input.misconceptionFires[input.verdict.misconceptionId] ?? 0)
    : 0;
  if (fires >= 2) {
    return "coach";
  }
  if (input.verdict.attemptsUsed >= 2) {
    return "review";
  }
  return "hint";
}

function sectionForMisconception(misconceptionId: string | null): string {
  if (misconceptionId && MISCONCEPTION_SECTION[misconceptionId]) {
    return MISCONCEPTION_SECTION[misconceptionId];
  }
  return "where-it-executes";
}

export function Pl400App() {
  const [phase, setPhase] = useState<ToolPhase>("lesson");
  const [ledger, setLedger] = useState<Ledger>(initialLedger);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [registeredTools, setRegisteredTools] = useState<ToolRosterEntry[]>(
    () => [...staticTools],
  );
  const [lockedTools, setLockedTools] = useState<string[]>([]);
  const [examActive, setExamActive] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(EXAM_SECONDS);
  const [moduleComplete, setModuleComplete] = useState(false);
  const { flashes, flash } = useToolRosterHighlights();
  const pendingRevokes = useRef<Map<string, number>>(new Map());
  const revealSeenRef = useRef(false);
  const examSubmitRef = useRef<() => void>(() => {});

  useEffect(() => {
    const pending = pendingRevokes.current;
    return () => {
      for (const id of pending.values()) {
        window.clearTimeout(id);
      }
      pending.clear();
    };
  }, []);

  const registerTool = useCallback(
    (name: string) => {
      const entry = dynamicTools[name];
      if (!entry) {
        return;
      }
      // A register cancels any in-flight revoke removal for the same tool,
      // so revoke -> quick re-register never leaves the roster missing it.
      const pendingRemoval = pendingRevokes.current.get(name);
      if (pendingRemoval !== undefined) {
        window.clearTimeout(pendingRemoval);
        pendingRevokes.current.delete(name);
      }
      setRegisteredTools((prev) => {
        if (prev.some((tool) => tool.name === name)) {
          return prev;
        }
        return [...prev, entry];
      });
      flash(name, "register");
    },
    [flash],
  );

  const revokeTool = useCallback(
    (name: string) => {
      flash(name, "revoke");
      const prior = pendingRevokes.current.get(name);
      if (prior !== undefined) {
        window.clearTimeout(prior);
      }
      const id = window.setTimeout(() => {
        setRegisteredTools((prev) => prev.filter((tool) => tool.name !== name));
        pendingRevokes.current.delete(name);
      }, REVOKE_REMOVE_MS);
      pendingRevokes.current.set(name, id);
    },
    [flash],
  );

  const setPhaseAndLedger = useCallback((next: ToolPhase) => {
    setPhase(next);
    setLedger((prev) => {
      return { ...prev, phase: next };
    });
  }, []);

  const handleExamSubmit = useCallback(() => {
    setExamActive(false);
    setExamSubmitted(true);
    setLockedTools([]);
    setPhaseAndLedger("debrief");
    for (const name of EXAM_LOCKED_TOOLS) {
      flash(name, "register");
    }
    registerTool("get_exam_debrief");
  }, [flash, registerTool, setPhaseAndLedger]);

  examSubmitRef.current = handleExamSubmit;

  useEffect(() => {
    if (!examActive || examSubmitted) {
      return;
    }
    if (secondsRemaining <= 0) {
      examSubmitRef.current();
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsRemaining((value) => value - 1);
    }, 1000);
    return () => {
      window.clearTimeout(id);
    };
  }, [examActive, examSubmitted, secondsRemaining]);

  const currentQuestion = publicQuestions[questionIndex];
  const nextAction = resolveNextAction({
    verdict,
    misconceptionFires: ledger.misconceptionFires,
    questionIndex,
    questionCount: publicQuestions.length,
    scores: ledger.scores,
  });
  const examLocked = examActive;

  const handleHint = useCallback(() => {
    if (!currentQuestion || examLocked) {
      return;
    }
    setHint(
      questionHints[currentQuestion.id] ??
        "Re-read the matching lesson section, then try again.",
    );
  }, [currentQuestion, examLocked]);

  function handleBeginPractice() {
    setPracticeStarted(true);
    setPhaseAndLedger("practice");
  }

  function handleSubmitAnswer(optionId: string) {
    if (!currentQuestion || examLocked) {
      return;
    }
    const prior = ledger.attempts.filter(
      (attempt) => attempt.questionId === currentQuestion.id,
    ).length;
    const attemptsUsed = prior + 1;
    const nextVerdict = gradeAnswer(currentQuestion.id, optionId, attemptsUsed);
    const attempt: AttemptRecord = {
      questionId: currentQuestion.id,
      optionId,
      correct: nextVerdict.correct,
      misconceptionId: nextVerdict.misconceptionId,
      timestamp: Date.now(),
    };
    setVerdict(nextVerdict);
    setLedger((prev) => {
      const misconceptionFires = { ...prev.misconceptionFires };
      if (nextVerdict.misconceptionId) {
        const currentFires = misconceptionFires[nextVerdict.misconceptionId] ?? 0;
        misconceptionFires[nextVerdict.misconceptionId] = currentFires + 1;
      }
      return {
        ...prev,
        attempts: [...prev.attempts, attempt],
        misconceptionFires,
      };
    });
  }

  function handleNextAction(action: NextAction) {
    if (examLocked) {
      return;
    }
    if (action === "hint") {
      handleHint();
      return;
    }
    if (action === "review") {
      scrollToSection(sectionForMisconception(verdict?.misconceptionId ?? null));
      setPhaseAndLedger("remediation");
      return;
    }
    if (action === "coach") {
      scrollToSection(sectionForMisconception(verdict?.misconceptionId ?? null));
      registerTool("get_misconception_brief");
      setPhaseAndLedger("remediation");
      return;
    }
    if (action === "go_deeper") {
      setQuestionIndex((index) => index + 1);
      setVerdict(null);
      setHint(null);
      return;
    }
    if (action === "advance") {
      registerTool("advance_module");
      setModuleComplete(true);
    }
  }

  function handleMasterRubric() {
    setLedger((prev) => {
      return { ...prev, scores: MASTERED_SCORES };
    });
    registerTool("advance_module");
  }

  function handleResetRubric() {
    setLedger((prev) => {
      return {
        ...prev,
        scores: {
          recall: initialScores.recall,
          connections: initialScores.connections,
          application: initialScores.application,
          transfer: initialScores.transfer,
        },
      };
    });
    setModuleComplete(false);
    revokeTool("advance_module");
  }

  function handleExamStart() {
    setSecondsRemaining(EXAM_SECONDS);
    setExamActive(true);
    setExamSubmitted(false);
    setLockedTools([...EXAM_LOCKED_TOOLS]);
    setPhaseAndLedger("exam");
    for (const name of EXAM_LOCKED_TOOLS) {
      flash(name, "revoke");
    }
  }

  const handleDrillPhaseChange = useCallback(
    (drillPhase: "mutate" | "commit" | "reveal") => {
      if (drillPhase === "reveal") {
        revealSeenRef.current = true;
        registerTool("reveal_outcome");
        setPhaseAndLedger("drill");
        return;
      }
      if (drillPhase === "mutate" && revealSeenRef.current) {
        revealSeenRef.current = false;
        revokeTool("reveal_outcome");
      }
    },
    [registerTool, revokeTool, setPhaseAndLedger],
  );

  const prescribedDrill = DRILL_BY_DIMENSION[weakestDimension(ledger.scores)];
  const showQuiz = practiceStarted && Boolean(currentQuestion);

  return (
    <div className="pl400">
      <header className="pl400-header">
        <h1>PL-400 — Mastery Gate</h1>
        <p>
          Dataverse plugin execution: the pipeline, images, and the difference
          between a veto and a side effect. The site grades; the agent coaches
          through the tools the roster currently permits.
        </p>
        <span className="pl400-phase">phase: {phase}</span>
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
                onClick={() => scrollToSection("where-it-executes")}
              >
                Jump to remediation section
              </button>
            </div>
            {showQuiz && currentQuestion ? (
              <div style={{ marginTop: "1rem" }}>
                <QuizCard
                  question={currentQuestion}
                  questionNumber={questionIndex + 1}
                  questionCount={publicQuestions.length}
                  verdict={verdict}
                  onSubmit={handleSubmitAnswer}
                  onHint={handleHint}
                  hint={hint}
                  disabled={examLocked}
                />
              </div>
            ) : null}
            {practiceStarted && !currentQuestion ? (
              <p className="muted">Practice items complete.</p>
            ) : null}
            {nextAction ? (
              <NextActionButton
                action={nextAction}
                onActivate={handleNextAction}
                disabled={examLocked}
              />
            ) : null}
            {moduleComplete ? (
              <div className="pl400-banner pl400-banner-success" role="status">
                Module complete.
              </div>
            ) : null}
            <div className="pl400-demo">
              <span className="pl400-demo-label">Demo controls</span>
              <p className="muted">
                These buttons simulate rubric updates the engine will own later.
                Mastery is per dimension; the gate does not average.
              </p>
              <div className="pl400-btn-row">
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={handleMasterRubric}
                >
                  Mark rubric mastered (demo)
                </button>
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={handleResetRubric}
                >
                  Reset rubric (demo)
                </button>
              </div>
            </div>
          </section>

          <section id="flip-drill">
            <h2>Flip-Condition drill</h2>
            <fieldset
              className={examLocked ? "drill-disabled" : undefined}
              disabled={examLocked}
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: 0 }}
            >
              <FlipConditionDrill
                scenario={flipScenario}
                onPhaseChange={handleDrillPhaseChange}
              />
            </fieldset>
          </section>

          <section id="exam">
            <h2>Exam</h2>
            <ExamModePanel
              active={examActive}
              secondsRemaining={secondsRemaining}
              lockedTools={lockedTools}
              onStart={handleExamStart}
              onSubmit={handleExamSubmit}
              submitted={examSubmitted}
            />
          </section>

          {examSubmitted ? (
            <section id="debrief">
              <h2>Debrief</h2>
              <DebriefCard
                ledger={ledger}
                misconceptionNames={misconceptionNames}
                prescribedDrill={prescribedDrill}
              />
            </section>
          ) : null}
        </div>

        <aside className="pl400-aside">
          <ToolRoster
            tools={registeredTools}
            lockedTools={lockedTools}
            flashes={flashes}
          />
          <RubricPanel scores={ledger.scores} />
        </aside>
      </div>
    </div>
  );
}

export default Pl400App;
