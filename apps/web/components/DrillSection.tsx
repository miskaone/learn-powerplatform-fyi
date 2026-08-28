"use client";

import { useEffect, useState } from "react";
import type { StartDrillResult } from "@learn/mastery-gate/engine";
import type { MasteryStack } from "../lib/masteryStack";
import type { MasteryGateView } from "./useMasteryGate";

type RevealView = {
  outcome: string;
  predictionWasCorrect: boolean;
  explanationAnchor: string;
};

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function DrillSection({ gate }: { gate: MasteryGateView }) {
  const stack: MasteryStack | null = gate.stack;
  const [presentation, setPresentation] = useState<StartDrillResult | null>(
    null,
  );
  const [lastReveal, setLastReveal] = useState<RevealView | null>(null);
  const [predictionText, setPredictionText] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const active = stack == null ? null : stack.engine.getActiveDrill();
  const results = stack == null ? [] : stack.engine.getDrillResults();
  const examActive = (() => {
    if (stack == null) {
      return false;
    }
    const status = stack.facade.getExamStatus();
    return status.active && !status.submitted;
  })();

  useEffect(() => {
    if (stack == null) {
      return;
    }
    const current = stack.engine.getActiveDrill();
    if (current == null || presentation != null) {
      return;
    }
    try {
      setPresentation(stack.engine.startDrill());
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }, [active?.scenarioId ?? null, stack, presentation]);

  function clearTransient(): void {
    setLastReveal(null);
    setPredictionText("");
    setReasonText("");
    setSelectedAssumptionId(null);
    setError(null);
  }

  function handleStartDrill(): void {
    if (stack == null) {
      return;
    }
    try {
      const result = stack.engine.startDrill();
      setPresentation(result);
      clearTransient();
      gate.refresh();
    } catch (caught) {
      const message = messageFrom(caught);
      setError(
        message.includes("exam-active")
          ? "An exam is running — finish it first."
          : message,
      );
    }
  }

  function handleEndDrill(): void {
    if (stack == null) {
      return;
    }
    stack.engine.endDrill();
    gate.refresh();
    setPresentation(null);
    clearTransient();
  }

  function handleMutate(): void {
    if (stack == null || active == null || selectedAssumptionId == null) {
      return;
    }
    try {
      const result = stack.facade.mutateAssumption(
        active.scenarioId,
        selectedAssumptionId,
      );
      if (!result.accepted) {
        setError("The engine refused that mutation.");
        return;
      }
      setError(null);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function handleCommit(): void {
    if (stack == null || active == null) {
      return;
    }
    try {
      const result = stack.facade.commitPrediction(
        active.scenarioId,
        predictionText,
        reasonText,
      );
      if (!result.committed) {
        setError("The engine refused that prediction.");
        return;
      }
      setError(null);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function handleReveal(): void {
    if (stack == null || active == null || active.prediction == null) {
      return;
    }
    try {
      const revealed = stack.facade.revealOutcome(active.scenarioId);
      setLastReveal(revealed);
      setPredictionText("");
      setReasonText("");
      setSelectedAssumptionId(null);
      setError(null);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  if (stack == null) {
    return <article className="pl400-card">loading…</article>;
  }

  const used = new Set(active?.usedAssumptionIds ?? []);
  const flippedAssumption =
    active?.currentAssumptionId == null
      ? null
      : (presentation?.assumptions.find(
          (assumption) => assumption.id === active.currentAssumptionId,
        ) ?? null);
  const flippedText =
    flippedAssumption?.text ?? active?.currentAssumptionId ?? null;
  const canCommit =
    predictionText.trim().length > 0 && reasonText.trim().length > 0;

  return (
    <article className="pl400-card flip-drill">
      {error ? (
        <p className="muted" role="alert">
          {error}
        </p>
      ) : null}

      {active == null ? (
        <>
          <h3>Flip-Condition drill</h3>
          <p>
            One mutation per round, engine-enforced. Commit is irreversible.
            Reveal unlocks only after commit — <code>reveal_outcome</code>{" "}
            registers only after <code>commit_prediction</code>, visible in the
            Tool Roster.
          </p>
          <div className="pl400-btn-row">
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              disabled={examActive}
              onClick={handleStartDrill}
            >
              Start drill
            </button>
          </div>
          {results.length > 0 ? (
            <>
              <ul className="debrief-list">
                {results.map((record, index) => (
                  <li key={`${record.scenarioId}-${record.timestamp}-${index}`}>
                    {record.outcomeComponent} —{" "}
                    {record.predictionWasCorrect
                      ? "prediction held"
                      : "prediction broke"}
                  </li>
                ))}
              </ul>
              <p className="muted">
                {results.length} transfer-dimension result(s) recorded on the
                ledger
              </p>
            </>
          ) : null}
        </>
      ) : null}

      {active != null && active.currentAssumptionId == null ? (
        <>
          <h3>{presentation?.title ?? "Flip-Condition drill"}</h3>
          <p>Round {active.round}</p>
          <p className="flip-helper">
            Flip this assumption — pick exactly one, then lock it in. One
            mutation per round; the engine locks it after acceptance.
          </p>
          <div
            className="flip-assumption-list"
            role="radiogroup"
            aria-label="Assumptions"
          >
            {(presentation?.assumptions ?? []).map((assumption) => {
              const revealed = used.has(assumption.id);
              const selected = selectedAssumptionId === assumption.id;
              return (
                <button
                  key={assumption.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={revealed}
                  className={
                    selected
                      ? "flip-assumption flip-assumption-selected"
                      : "flip-assumption"
                  }
                  onClick={() => setSelectedAssumptionId(assumption.id)}
                >
                  {assumption.text}
                  {revealed ? " — revealed" : ""}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="pl400-btn pl400-btn-primary"
            disabled={selectedAssumptionId == null || used.has(selectedAssumptionId)}
            onClick={handleMutate}
          >
            Flip this assumption
          </button>
        </>
      ) : null}

      {active != null &&
      active.currentAssumptionId != null &&
      active.prediction == null ? (
        <>
          <h3>{presentation?.title ?? "Flip-Condition drill"}</h3>
          <p>Round {active.round}</p>
          <p>
            Flipped assumption: <strong>{flippedText}</strong>
          </p>
          <p className="flip-helper">
            Commitment is final — reveal unlocks only after you commit.
          </p>
          <div className="flip-field">
            <label htmlFor="flip-prediction">Your prediction</label>
            <textarea
              id="flip-prediction"
              value={predictionText}
              maxLength={500}
              onChange={(event) => setPredictionText(event.target.value)}
            />
          </div>
          <div className="flip-field">
            <label htmlFor="flip-reason">Why? (required)</label>
            <textarea
              id="flip-reason"
              value={reasonText}
              maxLength={500}
              onChange={(event) => setReasonText(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="pl400-btn pl400-btn-primary"
            disabled={!canCommit}
            onClick={handleCommit}
          >
            Commit prediction
          </button>
        </>
      ) : null}

      {active != null && active.prediction != null ? (
        <>
          <h3>{presentation?.title ?? "Flip-Condition drill"}</h3>
          <p>Round {active.round}</p>
          <p>
            Committed prediction: <strong>{active.prediction.text}</strong>
          </p>
          <p className="muted">{active.prediction.reason}</p>
          <div className="pl400-btn-row">
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              onClick={handleReveal}
            >
              Reveal outcome
            </button>
          </div>
        </>
      ) : null}

      {lastReveal != null ? (
        <div className="flip-compare">
          <div>
            <h3>Decision-table outcome</h3>
            <p>
              <strong>{lastReveal.outcome}</strong>
            </p>
            <p>
              {lastReveal.predictionWasCorrect
                ? "prediction held"
                : "prediction broke"}
            </p>
            <p>
              <a href={"#" + lastReveal.explanationAnchor}>
                Why — lesson citation
              </a>
            </p>
          </div>
          <div>
            <p className="muted">
              Recorded to the ledger: transfer dimension · {results.length}{" "}
              drill result(s)
            </p>
          </div>
        </div>
      ) : null}

      {active != null ? (
        <div className="pl400-btn-row">
          <button type="button" className="pl400-btn" onClick={handleEndDrill}>
            End drill
          </button>
        </div>
      ) : null}

      {gate.agentDetected ? null : (
        <p className="pl400-phase">
          No agent needed — these buttons drive the same engine the drill tools
          expose.
        </p>
      )}
    </article>
  );
}
