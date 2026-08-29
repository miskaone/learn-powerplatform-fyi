"use client";

import { useEffect } from "react";
import type { LessonBriefPublic } from "@learn/mastery-gate/webmcp";
import "../app/pl-400/pl400.css";
import { lessonProgress, type MasteryStack } from "../lib/masteryStack";
import { PracticePanel } from "./PracticePanel";
import { RubricPanel } from "./RubricPanel";
import { StartCoaching } from "./StartCoaching";
import { ToolInspectorPanel, useInspectorVisibility } from "./ToolInspector";
import { ToolRoster } from "./ToolRoster";
import { useMasteryGate } from "./useMasteryGate";

export function LessonPracticeSection(props: {
  slug: string;
  title: string;
  questionIds: readonly string[];
  brief: LessonBriefPublic;
}) {
  const { slug, title, questionIds, brief } = props;
  const gate = useMasteryGate();
  const inspector = useInspectorVisibility();
  const stack: MasteryStack | null = gate.stack;

  useEffect(() => {
    if (stack == null) {
      return;
    }
    stack.setActiveLesson(slug);
    // The stack is a page-lifetime singleton, so leaving this route must
    // release the lesson scope — otherwise get_current_context and the
    // question scope stay pinned to this lesson on unrelated pages
    // (cross-review finding 5). A sibling lesson mount re-scopes after this
    // cleanup runs; the hub sets null on its own mount as before.
    return () => {
      if (stack.getActiveLessonSlug() === slug) {
        stack.setActiveLesson(null);
      }
    };
  }, [slug, stack]);

  // The brief changes identity when the learner commits the scenario and the
  // page reveals the expected answer; updating it must not release and
  // re-acquire the lesson scope.
  useEffect(() => {
    if (stack == null) {
      return;
    }
    stack.setLessonBrief(slug, brief);
  }, [slug, stack, brief]);

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
        fallbackAnchor={`${slug}-rule`}
        lessonSlug={slug}
      />
      <div className="lp-mastery-profile">
        <span className="lp-label">MASTERY PROFILE</span>
        <p className="muted">
          Rubric dimensions are track-wide — every lesson&apos;s practice
          feeds the same four scores.
        </p>
        <RubricPanel scores={gate.learner.scores} gatePassed={gate.learner.gatePassed} />
        {stack != null
          ? (() => {
              const drill = stack.facade.prescribeDrill();
              return (
                <p className="muted lp-drill-line">
                  Weakest dimension: <strong>{drill.targetDimension}</strong>{" "}
                  — prescribed drill: <strong>{drill.drillKind}</strong>.{" "}
                  {drill.rationale}
                </p>
              );
            })()
          : null}
      </div>
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
            stuckTools={gate.stuckTools}
            flashes={gate.flashes}
            errorNotice={gate.syncError ?? undefined}
            modeLabel={
              gate.agentDetected
                ? "agent runtime detected — if your agent reports no callable tools, its host may not bridge tool invocation (verified: ChatGPT desktop browser, Chrome 152+ with the WebMCP flag)"
                : "no agent runtime detected"
            }
            notice={
              gate.agentDetected
                ? undefined
                : "No agent runtime detected — page buttons drive the same engine. Listing the tools that WOULD be registered."
            }
            inspectorToggle={{
              open: inspector.visible,
              onToggle: inspector.toggle,
            }}
          />
        </details>
        <details className="lp-tools">
          <summary>Start coaching</summary>
          <StartCoaching agentDetected={gate.agentDetected} compact />
        </details>
      </div>
      <ToolInspectorPanel gate={gate} visible={inspector.visible} />
    </div>
  );
}
