"use client";

import { useEffect, useRef, useState } from "react";
import { KICKOFF_PROMPT } from "../lib/kickoffPrompt";

/**
 * Always-visible kickoff affordance in the lesson topbar. The full Start
 * Coaching panel lives at the practice band; coaching usually STARTS at the
 * top of a lesson, so the prompt must be reachable there too (owner report,
 * 2026-08-29: "the coach prompt is not available in my view").
 */
export function TopbarCoachPrompt() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(KICKOFF_PROMPT);
      setCopied(true);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the full panel at the practice band has the
      // selectable fallback text
    }
  }

  return (
    <button
      type="button"
      className="lp-topbar-coach"
      onClick={() => void copy()}
      aria-live="polite"
    >
      {copied ? "Copied ✓" : "Copy coach prompt"}
    </button>
  );
}
