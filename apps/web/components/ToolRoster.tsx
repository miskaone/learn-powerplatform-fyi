"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolRosterEntry } from "../lib/types";

export type RosterEvent = { tool: string; kind: "register" | "revoke" };

const FLASH_MS = 1400;

export function useToolRosterHighlights(): {
  flashes: Record<string, "register" | "revoke">;
  flash: (tool: string, kind: "register" | "revoke") => void;
} {
  const [flashes, setFlashes] = useState<Record<string, "register" | "revoke">>(
    {},
  );
  const timers = useRef<Record<string, number>>({});

  const flash = useCallback((tool: string, kind: "register" | "revoke") => {
    const prior = timers.current[tool];
    if (prior !== undefined) {
      window.clearTimeout(prior);
    }

    setFlashes((prev) => {
      return { ...prev, [tool]: kind };
    });

    timers.current[tool] = window.setTimeout(() => {
      setFlashes((prev) => {
        const next = { ...prev };
        delete next[tool];
        return next;
      });
      delete timers.current[tool];
    }, FLASH_MS);
  }, []);

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      for (const id of Object.values(timersAtMount)) {
        window.clearTimeout(id);
      }
    };
  }, []);

  return { flashes, flash };
}

export function ToolRoster(props: {
  tools: ToolRosterEntry[];
  lockedTools?: string[];
  stuckTools?: string[];
  flashes?: Record<string, "register" | "revoke">;
  notice?: string;
  /** Non-blocking error line (e.g. a failed registry sync). */
  errorNotice?: string;
  modeLabel?: string;
}) {
  const locked = new Set(props.lockedTools ?? []);
  const stuck = new Set(props.stuckTools ?? []);
  const flashes = props.flashes ?? {};
  const count = props.tools.length;

  return (
    <section className="pl400-card tool-roster" aria-labelledby="tool-roster-heading">
      <h2 id="tool-roster-heading">Tool Roster</h2>
      {props.modeLabel ? (
        <p className="pl400-phase">{props.modeLabel}</p>
      ) : null}
      {props.errorNotice ? (
        <p className="tool-roster-error" role="alert">
          {props.errorNotice}
        </p>
      ) : null}
      {props.notice ? <p className="muted">{props.notice}</p> : null}
      <p className="tool-roster-count">
        {count} {count === 1 ? "tool" : "tools"} registered
      </p>
      <ul className="tool-roster-list">
        {props.tools.map((tool) => {
          const isLocked = locked.has(tool.name);
          const flashKind = flashes[tool.name];
          const rowClass = [
            "tool-roster-row",
            isLocked ? "tool-locked" : "",
            flashKind === "register" ? "tool-flash-register" : "",
            flashKind === "revoke" ? "tool-flash-revoke" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={tool.name} className={rowClass}>
              <code>{tool.name}</code>
              {tool.dynamic ? (
                <span className="tool-dynamic-badge">dynamic</span>
              ) : null}
              {stuck.has(tool.name) ? (
                <span className="tool-stuck-badge">revoking — draining</span>
              ) : null}
              {isLocked ? (
                <span className="tool-lock-label">locked</span>
              ) : null}
              <span className="tool-roster-desc">{tool.description}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
