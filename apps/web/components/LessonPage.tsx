"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LessonPageData } from "../lib/lessonPages";
import "../app/pl-400/lesson.css";
import { LessonPracticeSection } from "./LessonPracticeSection";

const DRILL_ORDER = [
  ["recall", "RECALL"],
  ["connections", "CONNECTIONS"],
  ["application", "APPLICATION"],
  ["transfer", "TRANSFER"],
] as const;

function scenarioStorageKey(slug: string): string {
  return `mastery-gate:lesson:${slug}:scenario`;
}

function readScenarioCommit(slug: string): { text: string } | null {
  try {
    const raw = localStorage.getItem(scenarioStorageKey(slug));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as { committed?: unknown; text?: unknown };
    if (record.committed !== true || typeof record.text !== "string") {
      return null;
    }
    return { text: record.text };
  } catch {
    return null;
  }
}

function persistScenarioCommit(slug: string, text: string): void {
  try {
    localStorage.setItem(
      scenarioStorageKey(slug),
      JSON.stringify({
        committed: true,
        text,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // ignore quota / private-mode failures
  }
}

function clearScenarioCommit(slug: string): void {
  try {
    localStorage.removeItem(scenarioStorageKey(slug));
  } catch {
    // ignore
  }
}

function importanceClass(importance: string): string {
  const normalized = importance.toLowerCase();
  if (normalized === "important distinction") {
    return "lp-importance-distinction";
  }
  if (normalized === "production nuance") {
    return "lp-importance-nuance";
  }
  return "lp-importance-foundational";
}

function ScenarioCommit({
  slug,
  expectedAnswer,
}: {
  slug: string;
  expectedAnswer: string;
}) {
  const [committed, setCommitted] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const stored = readScenarioCommit(slug);
    if (!stored) {
      return;
    }
    setText(stored.text);
    setCommitted(true);
  }, [slug]);

  if (committed) {
    return (
      <div className="lp-commit">
        <span className="lp-label">YOUR COMMITMENT</span>
        <p className="lp-commit-echo" style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </p>
        <div className="lp-expected">
          <span className="lp-label">EXPECTED ANSWER</span>
          <p>{expectedAnswer}</p>
        </div>
        <button
          type="button"
          className="lp-btn lp-btn-ghost"
          onClick={() => {
            clearScenarioCommit(slug);
            setCommitted(false);
          }}
        >
          Reset commitment
        </button>
      </div>
    );
  }

  const textareaId = `${slug}-commitment`;

  return (
    <div className="lp-commit">
      <label className="lp-label" htmlFor={textareaId}>
        YOUR COMMITMENT
      </label>
      <p className="lp-commit-help">
        Write your answer before the mechanism is revealed — commitment is what
        makes the reveal teach.
      </p>
      <textarea
        id={textareaId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type the decision you would make, and why…"
      />
      <button
        type="button"
        className="lp-btn lp-btn-primary"
        disabled={text.trim() === ""}
        onClick={() => {
          persistScenarioCommit(slug, text);
          setCommitted(true);
        }}
      >
        Commit answer
      </button>
    </div>
  );
}

function VisualWalkthrough({
  steps,
}: {
  steps: LessonPageData["visual"]["steps"];
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) {
    return null;
  }

  const n = String(index + 1).padStart(2, "0");

  return (
    <div className="lp-visual">
      <div className="lp-visual-controls">
        {steps.map((item, i) => {
          const active = i === index;
          return (
            <button
              key={`${item.label}-${i}`}
              type="button"
              className={active ? "active" : undefined}
              aria-current={active ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              {String(i + 1).padStart(2, "0")} · {item.label}
            </button>
          );
        })}
      </div>
      <div className="lp-visual-body">
        <div className="lp-visual-state" aria-live="polite">
          <span className="lp-label">
            STEP {n} · {step.label.toUpperCase()}
          </span>
          <strong className="lp-visual-state-name">{step.state}</strong>
          <p>{step.detail}</p>
        </div>
        <div className="lp-visual-nav">
          <button
            type="button"
            className="lp-btn"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            ← Prev
          </button>
          <span className="lp-visual-counter">
            {index + 1} / {steps.length}
          </span>
          <button
            type="button"
            className="lp-btn"
            disabled={index >= steps.length - 1}
            onClick={() =>
              setIndex((current) => Math.min(steps.length - 1, current + 1))
            }
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export function LessonPage({ lesson }: { lesson: LessonPageData }) {
  const showMnemonic =
    Boolean(lesson.mnemonic) && lesson.mnemonic !== lesson.examClue;

  return (
    <div className="lp">
      <div className="lp-topbar">
        <span className="lp-brand">{lesson.id}</span>
        <span className="lp-crumb">PL-400 / {lesson.topic.title}</span>
        <Link href="/pl-400/" className="lp-topbar-hub">
          Track hub
        </Link>
      </div>

      <header className="lp-hero">
        <p className="lp-kicker lp-label">
          {lesson.id} · PL-400 / {lesson.topic.title}
        </p>
        <h1>{lesson.title}</h1>
        <blockquote className="lp-epigraph">
          “{lesson.heroEpigraph}”
        </blockquote>
        <div id={`${lesson.slug}-rule`}>
          <p className="lp-rule">{lesson.governingRule}</p>
        </div>
        <div className="lp-clue" id={`${lesson.slug}-exam-clue`}>
          <span className="lp-label">EXAM-RECOGNITION CLUE</span>
          <p>
            <strong>{lesson.examClue}</strong>
          </p>
          {showMnemonic ? (
            <p className="lp-mnemonic">Mnemonic: {lesson.mnemonic}</p>
          ) : null}
        </div>
      </header>

      <section className="lp-section" id={`${lesson.slug}-scenario`}>
        <div className="lp-section-head">
          <span className="lp-label">01 / SCENARIO</span>
          <h2>Make the decision before seeing the mechanism.</h2>
        </div>
        <div className="lp-scenario">
          <p>{lesson.scenario.prompt}</p>
        </div>
        <ScenarioCommit
          slug={lesson.slug}
          expectedAnswer={lesson.scenario.expectedAnswer}
        />
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">02 / CONCEPT HIERARCHY</span>
          <h2>The ideas that change the answer.</h2>
        </div>
        <div className="lp-grid-2">
          {lesson.concepts.map((concept) => (
            <article key={concept.id} className="lp-card">
              <span className={`lp-label ${importanceClass(concept.importance)}`}>
                {concept.importance.toUpperCase()}
              </span>
              <h3>{concept.label}</h3>
              <p>{concept.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">
            03 / {lesson.visual.type.toUpperCase()}
          </span>
          <h2>{lesson.visual.title}</h2>
        </div>
        <VisualWalkthrough steps={lesson.visual.steps} />
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">04 / DISTRACTORS</span>
          <h2>Why the tempting choices fail.</h2>
        </div>
        <div className="lp-grid-2">
          {lesson.distractors.map((distractor) => (
            <article key={distractor.choice} className="lp-card">
              <span className="lp-label lp-importance-nuance">DISTRACTOR</span>
              <h3>{distractor.choice}</h3>
              <p>
                <strong>Tempting:</strong> {distractor.whyTempting}
              </p>
              <p>
                <strong>Fails:</strong> {distractor.whyWrong}
              </p>
            </article>
          ))}
        </div>
        <div className="lp-nuance" id={`${lesson.slug}-production`}>
          <span className="lp-label">PRODUCTION NUANCE</span>
          <ul>
            {lesson.productionNuance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="practice" className="lp-practice-band">
        <div className="lp-section">
          <div className="lp-section-head">
            <span className="lp-label">05 / RETRIEVAL LAB</span>
            <h2>Practice this lesson against the live engine.</h2>
          </div>
          <LessonPracticeSection
            slug={lesson.slug}
            title={lesson.title}
            questionIds={lesson.questionIds}
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">06 / TARGETED DRILLS</span>
          <h2>Strengthen the weakest dimension.</h2>
        </div>
        <div className="lp-grid-2">
          {DRILL_ORDER.map(([key, label]) => (
            <article key={key} className="lp-card">
              <span className="lp-label">{label}</span>
              <p>{lesson.drills[key]}</p>
            </article>
          ))}
        </div>
        <div className="lp-reflection">
          <span className="lp-label">REFLECTION</span>
          <ul>
            {lesson.reflection.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-final">
        <span className="lp-label">FINAL MENTAL MODEL</span>
        <h2>{lesson.mnemonic ?? lesson.examClue}</h2>
        {lesson.references.length > 0 ? (
          <div className="lp-refs">
            <span className="lp-label">OFFICIAL REFERENCES</span>
            <div className="lp-ref-row">
              {lesson.references.map((reference) => (
                <a
                  key={reference.url}
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="lp-chip"
                >
                  {reference.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <footer className="lp-footer">
        <span>
          {lesson.id} · PL-400 / {lesson.topic.title}
        </span>
        <Link href="/pl-400/">Back to the PL-400 track hub</Link>
      </footer>
    </div>
  );
}
