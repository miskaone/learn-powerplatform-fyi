"use client";

import { useEffect, useRef, useState } from "react";
import type { NextAction } from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { DEMO_MASTERY_QUOTE } from "../lib/content";
import { lessonIndex, ruleAnchorForQuestion } from "../lib/lessonIndex";
import {
  clearAllScenarioCommits,
  clearScenarioCommit,
} from "../lib/scenarioStorage";
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
  /**
   * Same-lesson anchor for review/coach when no verdict anchor is available.
   * Lesson pages pass their own `-rule` anchor; the hub omits it and the
   * fallback derives from the current question's owning lesson — never a
   * hardcoded first lesson (cross-review finding 3).
   */
  fallbackAnchor?: string;
  /**
   * When set, "Reset practice" retakes ONLY this lesson (its attempts, hints,
   * and scenario commitment) instead of wiping the whole track ledger
   * (cross-review finding 10).
   */
  lessonSlug?: string;
  /**
   * The rubric-at-mastery demo button submits ML-09 lesson prose as evidence,
   * so it belongs on the hub only — never replicated onto lesson pages
   * (cross-review finding 11).
   */
  showDemoRubric?: boolean;
}) {
  const { gate, questionIds, scopeLabel } = props;
  const { question, nextAction, practiceStarted } = gate;

  const [verdict, setVerdict] = useState<UiVerdict | null>(null);
  const [hint, setHint] = useState<{ questionId: string; text: string } | null>(
    null,
  );
  const [hintRefusal, setHintRefusal] = useState<string | null>(null);
  const [rubricNotice, setRubricNotice] = useState<string | null>(null);
  const [advancedBanner, setAdvancedBanner] = useState(false);

  // Question transitions can be driven from outside this panel (an agent
  // calling submit_answer, another route's panel, a reset). Stale hints and
  // verdicts must not survive under a different question (cross-review
  // finding 9): a hint renders only for its own question, and a verdict
  // lives while its question is current plus exactly one transition (that
  // powers the "moved on" banner), then clears.
  const currentQuestionId = question ? question.id : null;
  const prevQuestionIdRef = useRef<string | null>(currentQuestionId);
  useEffect(() => {
    const prev = prevQuestionIdRef.current;
    if (prev === currentQuestionId) {
      return;
    }
    prevQuestionIdRef.current = currentQuestionId;
    setHintRefusal(null);
    setHint((current) =>
      current && current.questionId === currentQuestionId ? current : null,
    );
    setVerdict((current) => {
      if (current === null) {
        return current;
      }
      if (
        current.questionId === currentQuestionId ||
        current.questionId === prev
      ) {
        return current;
      }
      return null;
    });
  }, [currentQuestionId]);

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
        misconceptionContrast: result.misconceptionId
          ? (brief?.contrast ?? null)
          : null,
        attemptNumber: result.attemptNumber,
        attemptsRemaining: result.attemptsRemaining,
        rationale: result.rationale,
        remediationAnchor: result.remediationAnchor,
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
      setHint({ questionId: current.id, text: result.hint });
      setHintRefusal(null);
      return;
    }
    setHint(null);
    setHintRefusal(hintRefusalMessage(result.refusal ?? "hint refused"));
  }

  function remediationTarget(): string | null {
    // Priority: the graded verdict's same-lesson anchor, then the hosting
    // lesson's own rule anchor, then the current question's owning lesson.
    // Misconception-brief anchors are NOT used here: shared misconceptions
    // carry a single anchor that can belong to a different lesson and would
    // eject the learner mid-practice (cross-review finding 2).
    if (verdict?.remediationAnchor) {
      return verdict.remediationAnchor;
    }
    if (props.fallbackAnchor) {
      return props.fallbackAnchor;
    }
    if (question) {
      return ruleAnchorForQuestion(question.id);
    }
    return null;
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
      const anchor = remediationTarget();
      if (anchor !== null) {
        currentStack.facade.navigateToAnchor(anchor);
      }
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

  function clearLocalState() {
    setVerdict(null);
    setHint(null);
    setHintRefusal(null);
    setRubricNotice(null);
    setAdvancedBanner(false);
  }

  function handleReset() {
    const currentStack = gate.stack;
    if (!currentStack) {
      return;
    }
    if (props.lessonSlug !== undefined) {
      // Lesson-scoped retake: this lesson's attempts, hints, and scenario
      // commitment only. The track ledger and rubric survive.
      currentStack.engine.resetQuestions(questionIds);
      clearScenarioCommit(props.lessonSlug);
      clearLocalState();
      gate.refresh();
      return;
    }
    clearAllScenarioCommits(lessonIndex.map((entry) => entry.slug));
    gate.resetSession();
    clearLocalState();
  }

  const verdictForQuestion =
    verdict && question && verdict.questionId === question.id ? verdict : null;
  const movedOnVerdict =
    verdict && verdict.questionId !== (question ? question.id : null)
      ? verdict
      : null;
  const questionIndex = question ? questionIds.indexOf(question.id) : -1;
  const questionNumber = questionIndex >= 0 ? questionIndex + 1 : 1;
  const questionCount = questionIds.length;
  const completeMessage = scopeLabel.startsWith("this lesson")
    ? "This lesson's practice items are complete."
    : "Practice items complete.";
  const resetLabel =
    props.lessonSlug !== undefined
      ? "Reset this lesson's practice"
      : "Reset session (entire track)";
  const currentHint =
    hint && question && hint.questionId === question.id ? hint.text : null;

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
      {movedOnVerdict ? (
        movedOnVerdict.correct ? (
          <div className="pl400-banner pl400-banner-success" role="status">
            {question
              ? "Correct — next question loaded."
              : "Correct — practice items complete."}
            {movedOnVerdict.rationale ? (
              <p className="pl400-rationale">{movedOnVerdict.rationale}</p>
            ) : null}
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
        ) : (
          <div className="pl400-banner pl400-banner-danger" role="status">
            Attempts exhausted —{" "}
            {question ? "next question loaded." : "practice items complete."}{" "}
            Misconception:{" "}
            {movedOnVerdict.misconceptionName ??
              movedOnVerdict.misconceptionId ??
              "unnamed misconception"}
            .
            {movedOnVerdict.misconceptionContrast ? (
              <p className="pl400-rationale">
                {movedOnVerdict.misconceptionContrast}
              </p>
            ) : null}
            {movedOnVerdict.rationale ? (
              <p className="pl400-rationale">{movedOnVerdict.rationale}</p>
            ) : null}
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
        )
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
            hint={currentHint}
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
          {props.showDemoRubric ? (
            <button
              type="button"
              className="pl400-btn"
              onClick={handleMasterRubric}
            >
              Score rubric at mastery (demo)
            </button>
          ) : null}
          <button
            type="button"
            className="pl400-btn"
            onClick={handleReset}
          >
            {resetLabel}
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
