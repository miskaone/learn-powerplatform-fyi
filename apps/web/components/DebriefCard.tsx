"use client";

import type { Ledger, RubricDimension } from "@learn/mastery-gate/schema";

const DIMENSIONS: RubricDimension[] = [
  "recall",
  "connections",
  "application",
  "transfer",
];

function fireLabel(count: number): string {
  if (count === 1) {
    return "fired once";
  }
  if (count === 2) {
    return "fired twice";
  }
  return `fired ${count} times`;
}

export function DebriefCard(props: {
  ledger: Ledger;
  misconceptionNames: Record<string, string>;
  prescribedDrill: string;
}) {
  const fireEntries = Object.entries(props.ledger.misconceptionFires).filter(
    ([, count]) => count > 0,
  );
  const correctCount = props.ledger.attempts.filter((attempt) => attempt.correct)
    .length;
  const attemptCount = props.ledger.attempts.length;

  return (
    <article className="pl400-card debrief-card">
      <h3>Session debrief</h3>
      <h4>What fired</h4>
      {fireEntries.length === 0 ? (
        <p>No misconceptions fired — clean run.</p>
      ) : (
        <ul className="debrief-list">
          {fireEntries.map(([id, count]) => (
            <li key={id}>
              {props.misconceptionNames[id] ?? id} ({id}) — {fireLabel(count)}
            </li>
          ))}
        </ul>
      )}
      <h4>Rubric</h4>
      {DIMENSIONS.map((dimension) => (
        <p key={dimension} className="debrief-rubric-line">
          {dimension}: {props.ledger.scores[dimension]}/4
        </p>
      ))}
      <p className="debrief-attempts">
        {attemptCount} {attemptCount === 1 ? "attempt" : "attempts"},{" "}
        {correctCount} correct.
      </p>
      <p className="debrief-drill">
        Prescribed next drill: {props.prescribedDrill}
      </p>
    </article>
  );
}
