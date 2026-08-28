"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RubricDimension } from "@learn/mastery-gate/schema";
import type { ExamStatusPublic } from "@learn/mastery-gate/webmcp";
import { manifest } from "../lib/content";
import type { MasteryStack } from "../lib/masteryStack";
import type { MasteryGateView } from "./useMasteryGate";

const DIMENSIONS: readonly RubricDimension[] = [
  "recall",
  "connections",
  "application",
  "transfer",
];

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function misconceptionLabel(id: string): string {
  for (const misconception of manifest.misconceptions) {
    if (misconception.id === id) {
      return `${misconception.name} (${id})`;
    }
  }
  return id;
}

export function ExamSection({ gate }: { gate: MasteryGateView }) {
  const stack: MasteryStack | null = gate.stack;
  const [status, setStatus] = useState<ExamStatusPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef(gate.refresh);
  refreshRef.current = gate.refresh;

  const refreshStatus = useCallback(() => {
    if (stack == null) {
      return;
    }
    setStatus(stack.facade.getExamStatus());
  }, [stack]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, gate.learner]);

  const ticking = status?.active === true && status.submitted === false;
  useEffect(() => {
    if (stack == null || !ticking) {
      return;
    }
    const id = window.setInterval(() => {
      const next = stack.facade.getExamStatus();
      setStatus(next);
      if (next.submitted) {
        window.clearInterval(id);
        refreshRef.current();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [stack, ticking]);

  if (stack == null) {
    return <article className="pl400-card">loading…</article>;
  }

  const live = stack;
  const drillActive = live.engine.getActiveDrill() != null;
  const notStarted =
    status == null || (!status.active && !status.submitted);
  const examActive = status != null && status.active && !status.submitted;
  const submitted = status != null && status.submitted;

  function handleStartExam(): void {
    try {
      live.facade.startExam();
      setError(null);
      refreshStatus();
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function handleSubmitExam(): void {
    try {
      live.facade.submitExam();
      setError(null);
      refreshStatus();
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function handleSubmitAnswer(questionId: string, optionId: string): void {
    try {
      live.facade.submitAnswer(questionId, optionId);
      setError(null);
      refreshStatus();
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function handleExitExam(): void {
    live.engine.exitExam();
    gate.refresh();
    setError(null);
    refreshStatus();
  }

  function handleRetake(): void {
    try {
      live.facade.startExam();
      setError(null);
      refreshStatus();
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  let debrief: ReturnType<MasteryStack["facade"]["getExamDebrief"]> | null =
    null;
  let debriefError: string | null = null;
  if (submitted) {
    try {
      debrief = live.facade.getExamDebrief();
    } catch (caught) {
      debriefError = messageFrom(caught);
    }
  }

  const question = examActive ? live.facade.getCurrentQuestion() : null;
  const allAnswered =
    examActive &&
    status != null &&
    (question == null ||
      (status.questionsTotal > 0 &&
        status.questionsAnswered >= status.questionsTotal));
  const locked = Object.keys(live.toolMeta).filter(
    (name) => !gate.rosterNames.includes(name),
  );

  return (
    <article className="pl400-card exam-panel">
      {notStarted ? (
        <>
          <h3>Exam mode</h3>
          <p>
            Starting the exam REVOKES the coaching toolset — mass
            deregistration, visible live in the Tool Roster; only exam tools
            survive until submit.
          </p>
          {!gate.learner.gatePassed ? (
            <p className="muted">
              Locked — the mastery gate (every dimension ≥ 3) must open first.
            </p>
          ) : null}
          {drillActive ? (
            <p className="muted">Finish or end the active drill first.</p>
          ) : null}
          <div className="pl400-btn-row">
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              disabled={!gate.learner.gatePassed || drillActive}
              onClick={handleStartExam}
            >
              Start exam
            </button>
          </div>
        </>
      ) : null}

      {examActive && status != null ? (
        <>
          <h3>Exam mode</h3>
          <p className="exam-timer" aria-live="polite">
            {formatMmSs(status.remainingSeconds)}
          </p>
          <p className="muted">
            answered {status.questionsAnswered} of {status.questionsTotal}
          </p>
          {allAnswered || question == null ? (
            <p>All questions answered — submit when ready.</p>
          ) : (
            <>
              <p>{question.prompt}</p>
              <div className="pl400-options" role="group" aria-label="Answer options">
                {question.options.map((option, index) => {
                  const letter = OPTION_LETTERS[index] ?? String(index + 1);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="pl400-option"
                      onClick={() => handleSubmitAnswer(question.id, option.id)}
                    >
                      <span className="pl400-option-prefix">{letter}.</span>
                      {option.text}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p>Coaching tools revoked (live registry state)</p>
          <ul className="exam-locked-list">
            {locked.map((name) => (
              <li key={name} className="tool-locked">
                <code>{name}</code>
                <span className="tool-lock-label">locked</span>
              </li>
            ))}
          </ul>
          <div className="pl400-btn-row">
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              onClick={handleSubmitExam}
            >
              Submit exam
            </button>
          </div>
          <p className="muted">Unanswered questions grade as incorrect.</p>
        </>
      ) : null}

      {submitted ? (
        <>
          <h3>Exam submitted — debrief</h3>
          {debriefError ? <p className="muted">{debriefError}</p> : null}
          {debrief ? (
            <>
              {DIMENSIONS.map((dimension) => (
                <p key={dimension} className="debrief-rubric-line">
                  {dimension}: {debrief.scores[dimension]}/4
                </p>
              ))}
              <p>Concepts missed</p>
              {debrief.missedConceptIds.length === 0 ? (
                <p className="muted">none — clean run</p>
              ) : (
                <ul className="debrief-list">
                  {debrief.missedConceptIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              )}
              <p>Misconceptions fired</p>
              {debrief.misconceptionIdsFired.length === 0 ? (
                <p className="muted">none</p>
              ) : (
                <ul className="debrief-list">
                  {debrief.misconceptionIdsFired.map((id) => (
                    <li key={id}>{misconceptionLabel(id)}</li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
          <div className="pl400-btn-row">
            <button type="button" className="pl400-btn" onClick={handleExitExam}>
              Return to practice
            </button>
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              onClick={handleRetake}
            >
              Retake exam
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="muted" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
