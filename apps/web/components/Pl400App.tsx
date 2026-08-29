"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { RubricDimension } from "@learn/mastery-gate/schema";
import "../app/pl-400/pl400.css";
import { manifest } from "../lib/content";
// Slim index only — the full teaching catalog (lessonPages) is server-side
// and must not enter client bundles (cross-review finding 8).
import { deriveContinueTarget } from "../lib/continueTarget";
import { lessonIndex } from "../lib/lessonIndex";
import { lessonProgress, type MasteryStack } from "../lib/masteryStack";
import { DrillSection } from "./DrillSection";
import { ExamSection } from "./ExamSection";
import { LessonAim } from "./LessonReflection";
import { PracticePanel } from "./PracticePanel";
import { RubricPanel } from "./RubricPanel";
import { StartCoaching } from "./StartCoaching";
import { ToolInspectorPanel, useInspectorVisibility } from "./ToolInspector";
import { ToolRoster } from "./ToolRoster";
import { useMasteryGate } from "./useMasteryGate";
import { YourModelPanel } from "./YourModelPanel";

const DIMENSIONS: { key: RubricDimension; label: string }[] = [
  { key: "recall", label: "Recall" },
  { key: "connections", label: "Connections" },
  { key: "application", label: "Application" },
  { key: "transfer", label: "Transfer" },
];

export function Pl400App() {
  const gate = useMasteryGate();
  const inspector = useInspectorVisibility();
  const stack: MasteryStack | null = gate.stack;

  useEffect(() => {
    if (stack == null) {
      return;
    }
    stack.setActiveLesson(null);
  }, [stack]);

  const trackQuestionIds = manifest.questions.map((q) => q.id);
  const continueTarget =
    stack == null
      ? null
      : deriveContinueTarget(stack.engine.getLatestAttempt(), (ids) =>
          lessonProgress(stack, ids).attempted,
        );

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
                              met && gate.learner.gatePassed
                                ? "pl400-dim-chip pl400-dim-chip-met pl400-dim-chip-mastery"
                                : met
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
            {continueTarget ? (
              <Link
                href={`/pl-400/${continueTarget.slug}/`}
                className="pl400-continue"
              >
                Continue: {continueTarget.number} · {continueTarget.title} →
              </Link>
            ) : null}
            <div className="pl400-lesson-links">
              {lessonIndex.map((p, i) => {
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
                      {p.topicTitle}
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
            <LessonAim slug="track" />
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
              showDemoRubric
            />
          </section>

          <YourModelPanel gate={gate} />

          <section id="flip-drill">
            <h2>Flip-Condition drill</h2>
            <DrillSection gate={gate} />
          </section>

          <section id="exam">
            <h2>Exam</h2>
            <ExamSection gate={gate} />
          </section>

          <section id="debrief" className="pl400-card">
            <h2>Debrief</h2>
            <p>
              Text debrief unlocks with the Mastery Debrief graft —
              compose_debrief, get_narration_script, and advance_segment stay
              quarantined until then.
            </p>
          </section>
          <ToolInspectorPanel gate={gate} visible={inspector.visible} />
        </div>

        <aside className="pl400-aside">
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
