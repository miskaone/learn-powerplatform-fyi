"use client";

import { useEffect, useState } from "react";
import {
  getSharedMasteryStack,
  subscribeEngineMutations,
  type MasteryStack,
} from "../lib/masteryStack";

function useReflectionStack(): MasteryStack | null {
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setReady(true);
    return subscribeEngineMutations(() => {
      setTick((n) => n + 1);
    });
  }, []);

  if (!ready) {
    return null;
  }
  return getSharedMasteryStack();
}

function saveFailureMessage(reason: string | null): string {
  if (reason === "exam-active") {
    return "Locked during the exam.";
  }
  if (reason === "empty") {
    return "Write something first.";
  }
  if (reason === "too-many-entries") {
    return "Storage limit reached — edit an existing saved entry instead.";
  }
  return "Could not save right now.";
}

function ReflectionEditor(props: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saveLabel: string;
  error: string | null;
}) {
  const { id, label, help, value, onChange, onSave, saveLabel, error } = props;
  return (
    <div className="lp-commit">
      <label className="lp-label" htmlFor={id}>
        {label}
      </label>
      <p className="lp-commit-help">{help}</p>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="lp-btn lp-btn-primary"
        disabled={value.trim() === ""}
        onClick={onSave}
      >
        {saveLabel}
      </button>
      {error ? (
        <p className="lp-commit-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LessonAim({ slug }: { slug: string }) {
  const stack = useReflectionStack();
  const stored = stack?.facade.getLearnerState().lessonAims[slug];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setEditing(false);
    setError(null);
  }, [slug]);

  const save = () => {
    if (!stack) {
      return;
    }
    const result = stack.facade.setLessonAim(draft);
    if (!result.stored) {
      setError(saveFailureMessage(result.reason));
      return;
    }
    setError(null);
    setEditing(false);
  };

  if (stored && !editing) {
    return (
      <div className="lp-commit">
        <span className="lp-label">AIM</span>
        <p className="lp-commit-echo" style={{ whiteSpace: "pre-wrap" }}>
          {stored}
        </p>
        <button
          type="button"
          className="lp-btn lp-btn-ghost"
          onClick={() => {
            setDraft(stored);
            setEditing(true);
            setError(null);
          }}
        >
          Edit
        </button>
        <p className="lp-commit-help">
          {slug === "track"
            ? "Saved for the whole track. Your coach opens every session by asking this."
            : "Saved per lesson. Your coach opens every session by asking this."}
        </p>
      </div>
    );
  }

  return (
    <ReflectionEditor
      id={`${slug}-lesson-aim`}
      label="AIM"
      help="I'm reading this because I need to ___ — tell the page (and your coach) what you came for."
      value={draft}
      onChange={setDraft}
      onSave={save}
      saveLabel="Save aim"
      error={error}
    />
  );
}

export function RuleCompression({
  slug,
  governingRule,
}: {
  slug: string;
  governingRule: string;
}) {
  const stack = useReflectionStack();
  const stored = stack?.facade.getLearnerState().ruleCompressions[slug];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setEditing(false);
    setError(null);
  }, [slug]);

  const save = () => {
    if (!stack) {
      return;
    }
    const result = stack.facade.setRuleCompression(draft);
    if (!result.stored) {
      setError(saveFailureMessage(result.reason));
      return;
    }
    setError(null);
    setEditing(false);
  };

  if (!stored) {
    return (
      <ReflectionEditor
        id={`${slug}-rule-compression`}
        label="YOUR ONE-LINER"
        help="State this lesson's load-bearing rule in ONE line — from memory, before you scroll back up."
        value={draft}
        onChange={setDraft}
        onSave={save}
        saveLabel="Commit my one-liner"
        error={error}
      />
    );
  }

  return (
    <div className="lp-commit">
      <span className="lp-label">YOUR ONE-LINER</span>
      {editing ? (
        <>
          <textarea
            id={`${slug}-rule-compression`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            className="lp-btn lp-btn-primary"
            disabled={draft.trim() === ""}
            onClick={save}
          >
            Commit my one-liner
          </button>
        </>
      ) : (
        <>
          <p className="lp-commit-echo" style={{ whiteSpace: "pre-wrap" }}>
            {stored}
          </p>
          <button
            type="button"
            className="lp-btn lp-btn-ghost"
            onClick={() => {
              setDraft(stored);
              setEditing(true);
              setError(null);
            }}
          >
            Rewrite
          </button>
        </>
      )}
      <div className="lp-expected">
        <span className="lp-label">THE AUTHORED RULE</span>
        <p>{governingRule}</p>
      </div>
      <p className="lp-commit-help">
        Compare them: what did you miss or overstate? Your coach can see your
        version and will ask the same question.
      </p>
      {error ? (
        <p className="lp-commit-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RunCommitment({ slug }: { slug: string }) {
  const stack = useReflectionStack();
  const stored = stack?.facade.getLearnerState().runCommitments[slug];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setEditing(false);
    setError(null);
  }, [slug]);

  const save = () => {
    if (!stack) {
      return;
    }
    const result = stack.facade.setRunCommitment(draft);
    if (!result.stored) {
      setError(saveFailureMessage(result.reason));
      return;
    }
    setError(null);
    setEditing(false);
  };

  if (stored && !editing) {
    return (
      <div className="lp-commit">
        <span className="lp-label">RUN</span>
        <p className="lp-commit-echo" style={{ whiteSpace: "pre-wrap" }}>
          {stored}
        </p>
        <button
          type="button"
          className="lp-btn lp-btn-ghost"
          onClick={() => {
            setDraft(stored);
            setEditing(true);
            setError(null);
          }}
        >
          Edit
        </button>
        <p className="lp-commit-help">
          Saved per lesson — the closing debrief replays these.
        </p>
      </div>
    );
  }

  return (
    <ReflectionEditor
      id={`${slug}-run-commitment`}
      label="RUN"
      help="One thing you will do with this — a decision you'll make differently, a checklist line you'll add, or an experiment you'll run. Name the flow, the environment, or the day. Vague intentions don't survive contact with Monday."
      value={draft}
      onChange={setDraft}
      onSave={save}
      saveLabel="Commit to it"
      error={error}
    />
  );
}
