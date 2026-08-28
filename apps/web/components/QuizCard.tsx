"use client";

import { useEffect, useState } from "react";
import type { QuestionPublic } from "@learn/mastery-gate/schema";
import type { UiVerdict } from "../lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export function QuizCard(props: {
  question: QuestionPublic;
  questionNumber: number;
  questionCount: number;
  verdict: UiVerdict | null;
  onSubmit: (optionId: string) => void;
  onHint: () => void;
  hint: string | null;
  disabled?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [props.question.id]);

  const locked = Boolean(props.disabled);
  const correctLock = props.verdict?.correct === true;

  return (
    <article className="pl400-card quiz-card">
      <div className="pl400-quiz-header">
        <h3>
          Question {props.questionNumber} of {props.questionCount}
        </h3>
      </div>
      <div className="pl400-chips">
        {props.question.concepts.map((concept) => (
          <span key={concept} className="pl400-chip">
            {concept}
          </span>
        ))}
      </div>
      <p>{props.question.prompt}</p>
      <div className="pl400-options" role="group" aria-label="Answer options">
        {props.question.options.map((option, index) => {
          const letter = OPTION_LETTERS[index] ?? String(index + 1);
          const selected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={
                selected ? "pl400-option pl400-option-selected" : "pl400-option"
              }
              disabled={locked || correctLock}
              aria-pressed={selected}
              onClick={() => setSelectedId(option.id)}
            >
              <span className="pl400-option-prefix">{letter}.</span>
              {option.text}
            </button>
          );
        })}
      </div>
      <div className="pl400-btn-row">
        <button
          type="button"
          className="pl400-btn pl400-btn-primary"
          disabled={locked || correctLock || selectedId === null}
          onClick={() => {
            if (selectedId) {
              props.onSubmit(selectedId);
            }
          }}
        >
          Submit answer
        </button>
        <button
          type="button"
          className="pl400-btn"
          disabled={locked}
          onClick={props.onHint}
        >
          Request hint
        </button>
      </div>
      {props.verdict ? (
        props.verdict.correct ? (
          <div className="pl400-banner pl400-banner-success" role="status">
            Correct.
            {props.verdict.defeatedMisconceptionName ? (
              <p className="pl400-myth">
                Defeats the myth:{" "}
                <strong>{props.verdict.defeatedMisconceptionName}</strong>.
              </p>
            ) : null}
            {props.verdict.rationale ? (
              <p className="pl400-rationale">{props.verdict.rationale}</p>
            ) : null}
          </div>
        ) : (
          <div className="pl400-banner pl400-banner-danger" role="status">
            Misconception detected:{" "}
            {props.verdict.misconceptionName ??
              props.verdict.misconceptionId ??
              "unnamed misconception"}
            . Attempt {props.verdict.attemptNumber};{" "}
            {props.verdict.attemptsRemaining} remaining.
            {props.verdict.misconceptionContrast ? (
              <p className="pl400-rationale">
                {props.verdict.misconceptionContrast}
              </p>
            ) : null}
            {props.verdict.rationale ? (
              <p className="pl400-rationale">{props.verdict.rationale}</p>
            ) : null}
          </div>
        )
      ) : null}
      {props.hint ? (
        <div className="pl400-hint" role="note">
          {props.hint}
        </div>
      ) : null}
    </article>
  );
}
