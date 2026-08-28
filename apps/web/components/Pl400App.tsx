"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { RubricDimension } from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { manifest } from "../lib/content";
import { lessonPages } from "../lib/lessonPages";
import { flipPreviewScenario } from "../lib/flipPreview";
import { lessonProgress, type MasteryStack } from "../lib/masteryStack";
import { ExamModePanel } from "./ExamModePanel";
import { FlipConditionDrill } from "./FlipConditionDrill";
import { PracticePanel } from "./PracticePanel";
import { RubricPanel } from "./RubricPanel";
import { StartCoaching } from "./StartCoaching";
import { ToolRoster } from "./ToolRoster";
import { useMasteryGate } from "./useMasteryGate";

const DIMENSIONS: { key: RubricDimension; label: string }[] = [
  { key: "recall", label: "Recall" },
  { key: "connections", label: "Connections" },
  { key: "application", label: "Application" },
  { key: "transfer", label: "Transfer" },
];

function noop(): void {}

export function Pl400App() {
  const gate = useMasteryGate();
  const stack: MasteryStack | null = gate.stack;

  useEffect(() => {
    if (stack == null) {
      return;
    }
    stack.setActiveLesson(null);
  }, [stack]);

  const trackQuestionIds = manifest.questions.map((q) => q.id);

  return (
    <div className="pl400">
      <header className="pl400-header">
        <h1>PL-400 — Mastery Gate</h1>
        <p>
          Five micro-lessons across two PL-400 objectives — Custom Connectors
          & Azure Integration, and Dataverse Extensibility & Platform Limits.
          The site grades; the agent coaches through the tools the roster
          currently permits.
        </p>
        <span className="pl400-phase">phase: {gate.uiPhase}</span>
      </header>

      <div className="pl400-layout">
        <div className="pl400-main">
          <section id="track-overview" className="pl400-card">
            <h2>Track overview</h2>
            <div className="pl400-overview-grid">
              {manifest.objectives.map((objective) => {
                const progress =
                  stack == null
                    ? {
                        attempted: 0,
                        correct: 0,
                        total: objective.questionIds.length,
                      }
                    : lessonProgress(stack, objective.questionIds);
                return (
                  <article
                    key={objective.id}
                    className="pl400-objective-card"
                  >
                    <h3>{objective.title}</h3>
                    <p className="muted">{objective.summary}</p>
                    <p className="muted">
                      {progress.correct} of {progress.total} correct ·{" "}
                      {progress.attempted} attempted
                    </p>
                    <div className="pl400-dim-chips">
                      {DIMENSIONS.map((dimension) => {
                        const score = gate.learner.scores[dimension.key];
                        const met = score >= 3;
                        return (
                          <span
                            key={dimension.key}
                            className={
                              met
                                ? "pl400-dim-chip pl400-dim-chip-met"
                                : "pl400-dim-chip"
                            }
                          >
                            {dimension.label} {score}/4
                          </span>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="muted">
              Rubric dimensions are track-wide — the mastery gate opens only
              when every dimension is ≥ 3.
            </p>
          </section>

          <section id="micro-lessons" className="pl400-card">
            <h2>Micro-lessons</h2>
            <p className="muted">
              Each lesson is a designed deep-dive: scenario first, mechanism
              second, distractor teardown, drills.
            </p>
            <div className="pl400-lesson-links">
              {lessonPages.map((p, i) => {
                const progress =
                  stack == null
                    ? {
                        attempted: 0,
                        correct: 0,
                        total: p.questionIds.length,
                      }
                    : lessonProgress(stack, p.questionIds);
                const progressLine =
                  progress.attempted === 0
                    ? "not started"
                    : `${progress.attempted} attempted · ${progress.correct}/${progress.total} correct`;
                return (
                  <Link
                    key={p.slug}
                    href={`/pl-400/${p.slug}/`}
                    className="pl400-lesson-link"
                  >
                    <span className="pl400-lesson-link-kicker">
                      {String(i + 1).padStart(2, "0")} · {p.id}
                    </span>
                    <span className="pl400-lesson-link-title">{p.title}</span>
                    <span className="pl400-lesson-link-topic">
                      {p.topic.title}
                    </span>
                    <span className="pl400-lesson-link-epigraph">
                      “{p.heroEpigraph}”
                    </span>
                    <span className="pl400-lesson-link-progress">
                      {progressLine}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="start-coaching" className="pl400-card">
            <StartCoaching agentDetected={gate.agentDetected} />
          </section>

          <section id="practice" className="pl400-card">
            <h2>Practice</h2>
            <p className="muted">
              One question at a time. A miss names the misconception — never
              the correct option. The hub runs the full track loop; each
              lesson page scopes practice to its own questions.
            </p>
            <PracticePanel
              gate={gate}
              questionIds={trackQuestionIds}
              scopeLabel={`full track — ${manifest.questions.length} questions`}
            />
          </section>

          <section id="flip-drill">
            <h2>Flip-Condition drill</h2>
            <span className="pl400-phase">
              inactive — engine drill state machine pending; drill tools not
              registered
            </span>
            <fieldset
              disabled
              className="drill-disabled"
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: 0 }}
            >
              <FlipConditionDrill scenario={flipPreviewScenario} />
            </fieldset>
          </section>

          <section id="exam">
            <h2>Exam</h2>
            <span className="pl400-phase">
              inactive — exam lifecycle pending; exam tools not registered
            </span>
            <fieldset
              disabled
              className="drill-disabled"
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: 0 }}
            >
              <ExamModePanel
                active={false}
                secondsRemaining={0}
                lockedTools={[]}
                onStart={noop}
                onSubmit={noop}
                submitted={false}
              />
            </fieldset>
          </section>

          <section id="debrief" className="pl400-card">
            <h2>Debrief</h2>
            <p>Inactive — the debrief unlocks after Exam Mode ships.</p>
          </section>
        </div>

        <aside className="pl400-aside">
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
          <RubricPanel scores={gate.learner.scores} />
          {gate.storageDegraded ? (
            <p className="muted">
              localStorage unavailable — progress is in-memory only.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export default Pl400App;
