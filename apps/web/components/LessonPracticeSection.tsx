"use client";

import { useEffect } from "react";
import "../app/pl-400/pl400.css";
import { lessonProgress, type MasteryStack } from "../lib/masteryStack";
import { PracticePanel } from "./PracticePanel";
import { StartCoaching } from "./StartCoaching";
import { ToolRoster } from "./ToolRoster";
import { useMasteryGate } from "./useMasteryGate";

export function LessonPracticeSection(props: {
  slug: string;
  title: string;
  questionIds: readonly string[];
}) {
  const { slug, title, questionIds } = props;
  const gate = useMasteryGate();
  const stack: MasteryStack | null = gate.stack;

  useEffect(() => {
    if (stack == null) {
      return;
    }
    stack.setActiveLesson(slug);
  }, [slug, stack]);

  const progress =
    stack == null
      ? { attempted: 0, correct: 0, total: questionIds.length }
      : lessonProgress(stack, questionIds);
  const progressLine =
    progress.attempted === 0
      ? "not started"
      : `${progress.correct} of ${progress.total} correct · ${progress.attempted} attempted`;

  return (
    <div
      id="lesson-practice-mount"
      data-lesson-practice-mount
      data-lesson-slug={slug}
      aria-label={`${title} practice`}
      className="lp-practice-mount lp-practice-live"
    >
      <span className="lp-label">THIS LESSON</span>
      <p className="muted">{progressLine}</p>
      <PracticePanel
        gate={gate}
        questionIds={questionIds}
        scopeLabel={`this lesson — ${questionIds.length} questions`}
      />
      {gate.storageDegraded ? (
        <p className="muted">
          localStorage unavailable — progress is in-memory only.
        </p>
      ) : null}
      <div className="lp-coach-row">
        <details className="lp-tools">
          <summary>Tool Roster — {gate.rosterNames.length} live</summary>
          <ToolRoster
            tools={gate.rosterTools}
            flashes={gate.flashes}
            errorNotice={gate.syncError ?? undefined}
            modeLabel={
              gate.agentDetected
                ? "agent runtime: modelContext detected (getTools polling)"
                : "no agent runtime detected"
            }
            notice={
              gate.agentDetected
                ? undefined
                : "No agent runtime detected — page buttons drive the same engine. Listing the tools that WOULD be registered."
            }
          />
        </details>
        <details className="lp-tools">
          <summary>Start coaching</summary>
          <StartCoaching agentDetected={gate.agentDetected} compact />
        </details>
      </div>
    </div>
  );
}
