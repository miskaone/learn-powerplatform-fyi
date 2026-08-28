"use client";

import { useEffect, useRef, useState } from "react";
import { KICKOFF_PROMPT } from "../lib/kickoffPrompt";

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function StartCoaching(props: {
  agentDetected: boolean;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  async function copyKickoff(): Promise<void> {
    const markCopied = () => {
      setCopied(true);
      setCopyFailed(false);
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
      copiedTimer.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimer.current = null;
      }, 2000);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(KICKOFF_PROMPT);
        markCopied();
        return;
      }
      if (fallbackCopy(KICKOFF_PROMPT)) {
        markCopied();
        return;
      }
      setCopyFailed(true);
    } catch {
      try {
        if (fallbackCopy(KICKOFF_PROMPT)) {
          markCopied();
          return;
        }
      } catch {
        // fall through
      }
      setCopyFailed(true);
    }
  }

  const body = (
    <>
      <p className="muted">
        Open this page inside the ChatGPT in-app browser (or any WebMCP-capable
        agent) and paste the kickoff prompt. The page&apos;s tools do the
        grading; the agent coaches through what the roster permits.
      </p>
      <pre className="pl400-kickoff-prompt">{KICKOFF_PROMPT}</pre>
      <div className="pl400-btn-row">
        <button
          type="button"
          className="pl400-btn pl400-btn-primary"
          onClick={() => {
            void copyKickoff();
          }}
        >
          {copied ? "Copied." : "Copy kickoff prompt"}
        </button>
      </div>
      {copyFailed ? (
        <p className="muted">Copy failed — select the text manually.</p>
      ) : null}
      <p className="muted">
        No agent? The page works with buttons alone — every engine path
        (practice, drill, exam, rubric) is drivable from the page controls.
      </p>
      <span className="pl400-phase">
        {props.agentDetected
          ? "agent runtime detected — tools are live on this page"
          : "no agent runtime detected — the roster lists the tools that will register"}
      </span>
    </>
  );

  if (props.compact) {
    return body;
  }

  return (
    <>
      <h2>Start coaching</h2>
      {body}
    </>
  );
}
