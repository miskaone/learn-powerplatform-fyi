"use client";

import { useEffect, useRef, useState } from "react";
import type { FlipScenario } from "../lib/types";

type DrillPhase = "mutate" | "commit" | "reveal";

const OUTCOME_GUESSES = [
  "Rule still enforced",
  "Rule silently bypassed",
  "Operation fails with an error",
] as const;

export function FlipConditionDrill(props: {
  scenario: FlipScenario;
  onComplete?: () => void;
  onPhaseChange?: (phase: DrillPhase) => void;
}) {
  const [phase, setPhase] = useState<DrillPhase>("mutate");
  const [assumptionId, setAssumptionId] = useState<string | null>(null);
  const [prediction, setPrediction] = useState("");
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const onPhaseChangeRef = useRef(props.onPhaseChange);
  onPhaseChangeRef.current = props.onPhaseChange;

  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  const selectedAssumption = props.scenario.assumptions.find(
    (item) => item.id === assumptionId,
  );
  const outcome = assumptionId ? props.scenario.outcomes[assumptionId] : undefined;
  const canCommit = prediction.trim().length > 0 && guess.length > 0;

  function resetToMutate() {
    setAssumptionId(null);
    setPrediction("");
    setGuess("");
    setRevealed(false);
    setPhase("mutate");
  }

  return (
    <article className="pl400-card flip-drill">
      <h3>{props.scenario.title}</h3>
      <p>{props.scenario.baseline}</p>

      {phase === "mutate" ? (
        <>
          <p className="flip-helper">
            Flip this assumption — pick exactly one, then lock it in.
          </p>
          <div
            className="flip-assumption-list"
            role="radiogroup"
            aria-label="Assumptions"
          >
            {props.scenario.assumptions.map((assumption) => {
              const selected = assumptionId === assumption.id;
              return (
                <button
                  key={assumption.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={
                    selected
                      ? "flip-assumption flip-assumption-selected"
                      : "flip-assumption"
                  }
                  onClick={() => setAssumptionId(assumption.id)}
                >
                  Flip this assumption: {assumption.text}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="pl400-btn pl400-btn-primary"
            disabled={!assumptionId}
            onClick={() => setPhase("commit")}
          >
            Lock in mutation
          </button>
        </>
      ) : null}

      {phase === "commit" ? (
        <>
          <p>
            Flipped assumption:{" "}
            <strong>{selectedAssumption?.text ?? assumptionId}</strong>
          </p>
          <p className="flip-helper">
            Commitment is final — reveal unlocks only after you commit.
          </p>
          <div className="flip-field">
            <label htmlFor="flip-prediction">Your prediction</label>
            <textarea
              id="flip-prediction"
              value={prediction}
              onChange={(event) => setPrediction(event.target.value)}
            />
          </div>
          <div className="flip-field">
            <label htmlFor="flip-guess">What happens?</label>
            <select
              id="flip-guess"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
            >
              <option value="">Choose an outcome</option>
              {OUTCOME_GUESSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="pl400-btn pl400-btn-primary"
            disabled={!canCommit}
            onClick={() => setPhase("reveal")}
          >
            Commit prediction
          </button>
        </>
      ) : null}

      {phase === "reveal" ? (
        <>
          {!revealed ? (
            <button
              type="button"
              className="pl400-btn pl400-btn-primary"
              onClick={() => {
                setRevealed(true);
                props.onComplete?.();
              }}
            >
              Reveal outcome
            </button>
          ) : (
            <>
              <div className="flip-compare">
                <div>
                  <h3>Decision-table outcome</h3>
                  <p>
                    <strong>{outcome?.outcome}</strong>
                  </p>
                  <p>{outcome?.explanation}</p>
                </div>
                <div>
                  <h3>Your committed prediction</h3>
                  <p>
                    <strong>{guess}</strong>
                  </p>
                  <p>{prediction}</p>
                </div>
              </div>
              <div className="pl400-btn-row">
                <button
                  type="button"
                  className="pl400-btn"
                  onClick={resetToMutate}
                >
                  Run another flip
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </article>
  );
}
