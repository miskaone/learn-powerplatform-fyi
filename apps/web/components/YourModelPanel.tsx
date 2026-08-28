"use client";

import { useState } from "react";
import Link from "next/link";
import { STORAGE_KEY } from "@learn/mastery-gate/engine";
import type { CoachNoteKind } from "@learn/mastery-gate/schema";
import { lessonForQuestion, lessonIndex } from "../lib/lessonIndex";
import { clearAllScenarioCommits } from "../lib/scenarioStorage";
import type { MasteryGateView } from "./useMasteryGate";

const NOTE_KINDS: readonly CoachNoteKind[] = [
  "observation",
  "preference",
  "context",
];

const ERASE_CONFIRM =
  "Erase all Mastery Gate data from this browser? This deletes your attempts, scores, notes, aims, and exam history. There is no undo — and no copy anywhere else.";

function noteRejectionMessage(reason: string | null): string {
  if (reason === "answer-content") {
    return "Rejected: notes must never contain answer content (question/option ids or option text).";
  }
  if (reason === "exam-active") {
    return "Locked during the exam.";
  }
  if (reason === "empty") {
    return "Write something first.";
  }
  return "Could not save right now.";
}

export function YourModelPanel(props: { gate: MasteryGateView }) {
  const { gate } = props;
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<CoachNoteKind>("observation");
  const [noteNotice, setNoteNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const stack = gate.stack;
  const evidence = stack ? stack.engine.getMisconceptionEvidence() : [];
  const learner = stack ? stack.facade.getLearnerState() : null;
  const coachingNotes = learner?.coachingNotes ?? [];
  const calibration = learner?.coachCalibration ?? null;

  function handleAddNote() {
    if (!stack) {
      return;
    }
    const result = stack.facade.logCoachingNote(draft, kind);
    if (result.stored) {
      setDraft("");
      setNoteNotice(null);
      return;
    }
    setNoteNotice(noteRejectionMessage(result.reason));
  }

  function handleExport() {
    setExportNotice(null);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        setExportNotice("Nothing stored yet.");
        return;
      }
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mastery-gate-v1.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportNotice("Nothing stored yet.");
    }
  }

  function handleErase() {
    if (!stack) {
      return;
    }
    if (!window.confirm(ERASE_CONFIRM)) {
      return;
    }
    stack.engine.reset();
    clearAllScenarioCommits(lessonIndex.map((entry) => entry.slug));
    window.location.reload();
  }

  return (
    <section id="your-model" className="pl400-card">
      <h2>Your model</h2>
      <p className="muted">
        This is the model of you this page shows any coach — the same evidence
        get_learner_state hands an agent. It is evidence, not a verdict, and
        never a permanent record: the erase button below destroys it.
      </p>

      <h3>Misconception map</h3>
      {evidence.length === 0 ? (
        <p className="muted">
          No misconceptions on record — nothing has fired yet.
        </p>
      ) : (
        evidence.map((entry) => {
          const brief = stack.facade.getMisconceptionBrief(
            entry.misconceptionId,
          );
          const name = brief?.name ?? entry.misconceptionId;
          return (
            <div key={entry.misconceptionId} className="pl400-model-entry">
              <p>
                <strong>{name}</strong>{" "}
                <span className="muted">fired {entry.fireCount}×</span>
              </p>
              <ul className="pl400-model-questions">
                {entry.questionIds.map((questionId) => {
                  const lesson = lessonForQuestion(questionId);
                  if (lesson === null) {
                    return <li key={questionId}>{questionId}</li>;
                  }
                  return (
                    <li key={questionId}>
                      <Link href={`/pl-400/${lesson.slug}/#practice`}>
                        {questionId} · {lesson.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}

      {calibration ? (
        <p className="muted">
          {`Coach calibration: ${calibration.confidenceHintCount} confidence hints (${calibration.confidenceAgreements} matched outcomes, ${calibration.highConfidenceMisses} high-confidence on missed answers) · ${calibration.rubricProposalCount} rubric proposals (${calibration.rubricProposalsAccepted} accepted).`}
        </p>
      ) : null}

      <h3>Coaching notes</h3>
      {coachingNotes.length === 0 ? (
        <p className="muted">
          No coaching notes yet — a coach (or you) can deposit durable
          observations here.
        </p>
      ) : (
        <ul className="pl400-notes">
          {coachingNotes.map((note, index) => (
            <li key={`${note.kind}-${index}`}>
              <span className="pl400-note-kind">{note.kind}</span> {note.text}
            </li>
          ))}
        </ul>
      )}
      <div className="pl400-note-form">
        <label className="muted" htmlFor="your-model-note">
          Add a coaching note
        </label>
        <textarea
          id="your-model-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <label className="muted" htmlFor="your-model-note-kind">
          Kind
        </label>
        <select
          id="your-model-note-kind"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value as CoachNoteKind)
          }
        >
          {NOTE_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="pl400-btn pl400-btn-primary"
          onClick={handleAddNote}
        >
          Add note
        </button>
        {noteNotice ? (
          <p className="pl400-banner pl400-banner-info" role="status">
            {noteNotice}
          </p>
        ) : null}
      </div>

      <div className="pl400-model-footer">
        <p className="muted">
          Your data never leaves your browser — everything below lives in
          localStorage on this device. The export is the complete record; erase
          destroys it.
        </p>
        <div className="pl400-btn-row">
          <button
            type="button"
            className="pl400-btn pl400-btn-primary"
            onClick={handleExport}
          >
            Export my data (JSON)
          </button>
          <button type="button" className="pl400-btn" onClick={handleErase}>
            Erase everything
          </button>
        </div>
        {exportNotice ? (
          <p className="pl400-banner pl400-banner-info" role="status">
            {exportNotice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
