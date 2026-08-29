"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LessonPageData } from "../lib/lessonPages";
import { toLessonBrief } from "../lib/lessonBrief";
import "../app/pl-400/lesson.css";
import {
  clearScenarioCommit,
  persistScenarioCommit,
  readScenarioCommit,
} from "../lib/scenarioStorage";
import { lessonIndex } from "../lib/lessonIndex";
import { LessonAim, RuleCompression, RunCommitment } from "./LessonReflection";
import { LessonPracticeSection } from "./LessonPracticeSection";
import { SectionMap } from "./SectionMap";
import { TopbarCoachPrompt } from "./TopbarCoachPrompt";

const DRILL_ORDER = [
  ["recall", "RECALL"],
  ["connections", "CONNECTIONS"],
  ["application", "APPLICATION"],
  ["transfer", "TRANSFER"],
] as const;

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
  onReveal,
}: {
  slug: string;
  onReveal: (expectedAnswer: string | null) => void;
}) {
  const [committed, setCommitted] = useState(false);
  const [text, setText] = useState("");
  // The expected answer never ships in the prerendered page (cross-review
  // finding 7): it is fetched from /pl-400/scenario/<slug>.json only after
  // the learner commits, so the commit-before-reveal gate cannot be bypassed
  // by View Source or a DOM read.
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);
  const [revealError, setRevealError] = useState(false);

  const fetchReveal = useCallback(() => {
    setRevealError(false);
    void fetch(`/pl-400/scenario/${slug}.json`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`reveal fetch failed: ${String(response.status)}`);
        }
        const payload = (await response.json()) as {
          expectedAnswer?: unknown;
        };
        if (typeof payload.expectedAnswer !== "string") {
          throw new Error("reveal payload malformed");
        }
        setExpectedAnswer(payload.expectedAnswer);
        onReveal(payload.expectedAnswer);
      })
      .catch(() => {
        setRevealError(true);
        onReveal(null);
      });
  }, [slug, onReveal]);

  useEffect(() => {
    const stored = readScenarioCommit(slug);
    if (!stored) {
      return;
    }
    setText(stored.text);
    setCommitted(true);
    fetchReveal();
  }, [slug, fetchReveal]);

  if (committed) {
    return (
      <div className="lp-commit">
        <span className="lp-label">YOUR CALL</span>
        <p className="lp-commit-echo" style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </p>
        <div className="lp-expected">
          <span className="lp-label">EXPECTED ANSWER</span>
          {expectedAnswer !== null ? (
            <p>{expectedAnswer}</p>
          ) : revealError ? (
            <p className="muted">
              Could not load the expected answer.{" "}
              <button
                type="button"
                className="lp-btn lp-btn-ghost"
                onClick={fetchReveal}
              >
                Retry
              </button>
            </p>
          ) : (
            <p className="muted">Loading…</p>
          )}
        </div>
        <button
          type="button"
          className="lp-btn lp-btn-ghost"
          onClick={() => {
            clearScenarioCommit(slug);
            setCommitted(false);
            setExpectedAnswer(null);
            onReveal(null);
          }}
        >
          Reset commitment
        </button>
      </div>
    );
  }

  const textareaId = `${slug}-commitment`;
  const commit = () => {
    persistScenarioCommit(slug, text);
    setCommitted(true);
    fetchReveal();
  };

  return (
    <div className="lp-commit">
      <label className="lp-label" htmlFor={textareaId}>
        MAKE YOUR CALL
      </label>
      <p className="lp-commit-help">
        Decide before the reveal — locking in an answer is what makes the
        reveal teach.
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
        onClick={commit}
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
  // The coach may see the expected answer exactly when the learner can —
  // after their own commitment — and never before; it is never prerendered.
  const [scenarioExpectedAnswer, setScenarioExpectedAnswer] = useState<
    string | null
  >(null);
  const brief = useMemo(
    () => toLessonBrief(lesson, scenarioExpectedAnswer),
    [lesson, scenarioExpectedAnswer],
  );
  const showMnemonic =
    Boolean(lesson.mnemonic) && lesson.mnemonic !== lesson.examClue;
  const idx = lessonIndex.findIndex((entry) => entry.slug === lesson.slug);
  const prev = idx > 0 ? lessonIndex[idx - 1] : undefined;
  const next = idx >= 0 ? lessonIndex[idx + 1] : undefined;

  return (
    <div className="lp">
      <div className="lp-topbar">
        <span className="lp-brand">{lesson.id}</span>
        <span className="lp-crumb">PL-400 / {lesson.topic.title}</span>
        <TopbarCoachPrompt />
        <Link href="/pl-400/" className="lp-topbar-hub">
          Track hub
        </Link>
      </div>

      <SectionMap slug={lesson.slug} />

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
        <LessonAim slug={lesson.slug} />
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
          onReveal={setScenarioExpectedAnswer}
        />
      </section>

      <section className="lp-section" id={`${lesson.slug}-compress`}>
        <div className="lp-section-head">
          <span className="lp-label">02 / COMPRESS THE RULE</span>
          <h2>State the load-bearing rule in one line.</h2>
        </div>
        <RuleCompression
          slug={lesson.slug}
          governingRule={lesson.governingRule}
        />
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">03 / CONCEPT HIERARCHY</span>
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
            04 / {lesson.visual.type.toUpperCase()}
          </span>
          <h2>{lesson.visual.title}</h2>
        </div>
        <VisualWalkthrough steps={lesson.visual.steps} />
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">05 / DISTRACTORS</span>
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
            <span className="lp-label">06 / RETRIEVAL LAB</span>
            <h2>Practice this lesson against the live engine.</h2>
          </div>
          <LessonPracticeSection
            slug={lesson.slug}
            title={lesson.title}
            questionIds={lesson.questionIds}
            brief={brief}
          />
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-label">07 / TARGETED DRILLS</span>
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
        <div className="lp-nuance">
          <span className="lp-label">LIVE TRANSFER DRILL</span>
          <p>
            The Flip-Condition drill runs track-level against the live engine:
            flip one assumption, commit a prediction with your reasoning, then
            reveal the decision-table verdict — commit-then-reveal is
            engine-enforced.{" "}
            <Link href="/pl-400/#flip-drill">
              Open the Flip-Condition drill on the track hub
            </Link>
            .
          </p>
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

      <section className="lp-section" id={`${lesson.slug}-run`}>
        <div className="lp-section-head">
          <span className="lp-label">08 / RUN</span>
          <h2>Decide what this changes.</h2>
        </div>
        <RunCommitment slug={lesson.slug} />
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

      <nav className="lp-lesson-nav" aria-label="Lesson sequence">
        {prev ? (
          <Link
            href={`/pl-400/${prev.slug}/`}
            className="lp-lesson-nav-card lp-lesson-nav-prev"
          >
            <span className="lp-label">
              ← Previous · {String(idx).padStart(2, "0")}
            </span>
            <strong>{prev.title}</strong>
            <em>“{prev.heroEpigraph}”</em>
          </Link>
        ) : (
          <span className="lp-lesson-nav-spacer" aria-hidden="true" />
        )}
        {next ? (
          <Link
            href={`/pl-400/${next.slug}/`}
            className="lp-lesson-nav-card lp-lesson-nav-next"
          >
            <span className="lp-label">
              Next · {String(idx + 2).padStart(2, "0")} →
            </span>
            <strong>{next.title}</strong>
            <em>“{next.heroEpigraph}”</em>
          </Link>
        ) : (
          <span className="lp-lesson-nav-spacer" aria-hidden="true" />
        )}
      </nav>

      <footer className="lp-footer">
        <span>
          {lesson.id} · PL-400 / {lesson.topic.title}
        </span>
        <Link href="/pl-400/">Back to the PL-400 track hub</Link>
      </footer>
    </div>
  );
}
