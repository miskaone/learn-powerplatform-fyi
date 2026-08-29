"use client";

import type { RubricDimension, RubricScores } from "@learn/mastery-gate/schema";

const DIMENSIONS: { key: RubricDimension; label: string }[] = [
  { key: "recall", label: "Recall" },
  { key: "connections", label: "Connections" },
  { key: "application", label: "Application" },
  { key: "transfer", label: "Transfer" },
];

export function RubricPanel(props: { scores: RubricScores }) {
  const gateOpen = DIMENSIONS.every((dimension) => props.scores[dimension.key] >= 3);

  // Mastery accent is derived from engine-truth scores each render — it persists exactly while the gate holds and reverts on regress; no imperative flip tracking.
  return (
    <section
      className={
        gateOpen
          ? "pl400-card rubric-panel rubric-mastery"
          : "pl400-card rubric-panel"
      }
      aria-labelledby="rubric-heading"
    >
      <h2 id="rubric-heading">Rubric</h2>
      <div className="rubric-list">
        {DIMENSIONS.map((dimension) => {
          const score = props.scores[dimension.key];
          const met = score >= 3;
          return (
            <div
              key={dimension.key}
              className={met ? "rubric-row rubric-met" : "rubric-row"}
            >
              <span className="rubric-label">{dimension.label}</span>
              <div
                className="rubric-segments"
                aria-label={`${dimension.label} ${score} of 4`}
              >
                {[1, 2, 3, 4].map((segment) => (
                  <span
                    key={segment}
                    className={
                      score >= segment
                        ? "rubric-seg rubric-seg-filled"
                        : "rubric-seg"
                    }
                  />
                ))}
              </div>
              <span className="rubric-score">{score}/4</span>
            </div>
          );
        })}
      </div>
      <div className="rubric-gate">
        <span>Gate opens when every dimension ≥ 3</span>
        <span
          className={
            gateOpen
              ? "rubric-gate-chip rubric-gate-open"
              : "rubric-gate-chip rubric-gate-locked"
          }
        >
          {gateOpen ? "Gate: open" : "Gate: locked"}
        </span>
      </div>
    </section>
  );
}
