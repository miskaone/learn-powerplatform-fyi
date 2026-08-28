"use client";

import { useState } from "react";
import type { NextAction } from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { DEMO_MASTERY_QUOTE, lessonSections } from "../lib/content";
import type { UiVerdict } from "../lib/types";
import { NextActionButton } from "./NextActionButton";
import { QuizCard } from "./QuizCard";
import type { MasteryGateView } from "./useMasteryGate";

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

function isNextAction(value: NextAction | "continue" | null): value is NextAction {
  return (NEXT_ACTIONS as readonly string[]).includes(value ?? "");
}

function hintRefusalMessage(refusal: string): string {
  if (refusal === "tier2-requires-attempt") {
    return "Hint ladder: tier-2 refuses before a genuine first attempt — submit an answer first.";
  }
  if (refusal === "ladder-exhausted") {
    return "Hint ladder exhausted for this question.";
  }
  return refusal;
}

export function PracticePanel(props: {
  gate: MasteryGateView;
  questionIds: readonly string[];
  scopeLabel: string;
}) {
  const { gate, questionIds, scopeLabel } = props;
  const { question, nextAction, practiceStarted } = gate;

  const [verdict, setVerdict] = useState<UiVerdict | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintRefusal, setHintRefusal] = useState<string | null>(null);
  const [rubricNotice, setRubricNotice] = useState<string | null>(null);
  const [advancedBanner, setAdvancedBanner] = useState(false);

  function handleSubmitAnswer(optionId: string) {
    const current = question;
    const currentStack = gate.stack;
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
        gate.refresh();
        return;
      }
      throw error;
    }
  }

  function handleHint() {
    const current = question;
    const currentStack = gate.stack;
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
    const currentStack = gate.stack;
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
      currentStack.facade.navigateToAnchor(anchor);
      gate.enterRemediation();
      return;
    }
    if (action === "go_deeper") {
      setVerdict(null);
      setHint(null);
      setHintRefusal(null);
      gate.refresh();
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
    const currentStack = gate.stack;
    if (!currentStack) {
      return;
    }
    const rubricVerdict = currentStack.facade.scoreRubric({
      recall: MASTERY_EVIDENCE,
      connections: MASTERY_EVIDENCE,
      application: MASTERY_EVIDENCE,
      transfer: MASTERY_EVIDENCE,
    });
    setRubricNotice(
      rubricVerdict.accepted
        ? null
        : `Rubric rejected by the engine: ${rubricVerdict.rejectionReason ?? "unknown"}`,
    );
  }

  function handleLowConfidence() {
    const currentStack = gate.stack;
    if (!currentStack) {
      return;
    }
    gate.setNextAction(currentStack.facade.requestNextAction("low"));
  }

  function handleResetSession() {
    gate.resetSession();
    setVerdict(null);
    setHint(null);
    setHintRefusal(null);
    setRubricNotice(null);
    setAdvancedBanner(false);
  }

  const verdictForQuestion =
    verdict && question && verdict.questionId === question.id ? verdict : null;
  const showCorrectAdvance =
    verdict !== null &&
    verdict.correct &&
    verdict.questionId !== (question ? question.id : null);
  const questionIndex = question ? questionIds.indexOf(question.id) : -1;
  const questionNumber = questionIndex >= 0 ? questionIndex + 1 : 1;
  const questionCount = questionIds.length;
  const completeMessage = scopeLabel.startsWith("this lesson")
    ? "This lesson's practice items are complete."
    : "Practice items complete.";

  return (
    <>
      <p className="muted">{scopeLabel}</p>
      {!practiceStarted ? (
        <button
          type="button"
          className="pl400-btn pl400-btn-primary"
          onClick={() => gate.beginPractice()}
        >
          Begin practice
        </button>
      ) : null}
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
        <p className="muted">{completeMessage}</p>
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
      </div>
    </>
  );
}
