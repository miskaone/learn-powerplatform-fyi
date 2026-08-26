"use client";

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ExamModePanel(props: {
  active: boolean;
  secondsRemaining: number;
  lockedTools: string[];
  onStart: () => void;
  onSubmit: () => void;
  submitted: boolean;
}) {
  if (props.submitted) {
    return (
      <article className="pl400-card exam-panel">
        <h3>Exam mode</h3>
        <p>Exam submitted — debrief unlocked.</p>
      </article>
    );
  }

  if (!props.active) {
    return (
      <article className="pl400-card exam-panel">
        <h3>Exam mode</h3>
        <p>
          Exam mode revokes the coaching toolset — the agent cannot hint, coach,
          or reveal while the clock runs.
        </p>
        <button
          type="button"
          className="pl400-btn pl400-btn-primary"
          onClick={props.onStart}
        >
          Start exam
        </button>
      </article>
    );
  }

  return (
    <article className="pl400-card exam-panel">
      <h3>Exam mode</h3>
      <p className="exam-timer" aria-live="polite">
        {formatMmSs(props.secondsRemaining)}
      </p>
      <p>Coaching tools locked</p>
      <ul className="exam-locked-list">
        {props.lockedTools.map((name) => (
          <li key={name} className="tool-locked">
            <code>{name}</code>
            <span className="tool-lock-label">locked</span>
          </li>
        ))}
      </ul>
      <button type="button" className="pl400-btn pl400-btn-primary" onClick={props.onSubmit}>
        Submit exam
      </button>
    </article>
  );
}
