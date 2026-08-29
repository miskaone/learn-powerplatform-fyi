"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { scrollToSection } from "../lib/anchor";
import {
  sectionMapEntries,
  type SectionMapEntry,
} from "../lib/lessonIndex";
import { getSharedMasteryStack } from "../lib/masteryStack";

function SectionMapList({
  entries,
  activeAnchor,
  onNavigate,
  onSpotlight,
}: {
  entries: SectionMapEntry[];
  activeAnchor: string;
  onNavigate: (anchor: string) => void;
  onSpotlight: (anchor: string) => void;
}) {
  return (
    <ol className="lp-map-list">
      {entries.map((entry) => {
        const isActive = entry.anchor === activeAnchor;
        return (
          <li key={entry.anchor}>
            <button
              type="button"
              className={isActive ? "active" : undefined}
              aria-current={isActive ? "true" : undefined}
              onClick={() => onNavigate(entry.anchor)}
            >
              {entry.shortLabel}
            </button>
            <button
              type="button"
              className="lp-map-spot"
              aria-label={"Spotlight " + entry.shortLabel}
              onClick={() => onSpotlight(entry.anchor)}
            >
              ◎
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SectionMapFocus({
  onClear,
  onExamLighting,
}: {
  onClear: () => void;
  onExamLighting: () => void;
}) {
  return (
    <div className="lp-map-focus">
      <button type="button" onClick={onClear}>
        Clear focus
      </button>
      <button type="button" onClick={onExamLighting}>
        Exam lighting
      </button>
    </div>
  );
}

export function SectionMap({ slug }: { slug: string }) {
  const entries = useMemo(() => sectionMapEntries(slug), [slug]);
  const [activeAnchor, setActiveAnchor] = useState(
    () => entries[0]?.anchor ?? "",
  );

  useEffect(() => {
    let frame = 0;

    const updateActive = () => {
      frame = 0;
      let next = entries[0]?.anchor ?? "";
      for (const entry of entries) {
        const el = document.getElementById(entry.anchor);
        if (el && el.getBoundingClientRect().top <= 140) {
          next = entry.anchor;
        }
      }
      setActiveAnchor(next);
    };

    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = requestAnimationFrame(updateActive);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    updateActive();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [entries]);

  const onNavigate = useCallback((anchor: string) => {
    scrollToSection(anchor);
  }, []);

  // Page parity for the set_focus tool, engine guard included. Cross-review
  // finding 10: refusals must not be silent — the result feeds a status line.
  const [focusStatus, setFocusStatus] = useState<string>("");
  const report = useCallback(
    (result: { ok: boolean; reason: string | null }) => {
      setFocusStatus(result.ok ? "" : `Focus request refused: ${result.reason ?? "not applied"}`);
    },
    [],
  );

  const onSpotlight = useCallback((anchor: string) => {
    report(getSharedMasteryStack().facade.setFocus("focus-section", anchor));
  }, [report]);

  const onClear = useCallback(() => {
    report(getSharedMasteryStack().facade.setFocus("clear-focus"));
  }, [report]);

  const onExamLighting = useCallback(() => {
    report(getSharedMasteryStack().facade.setFocus("exam-lighting"));
  }, [report]);

  return (
    <>
      <nav className="lp-map lp-map-rail" aria-label="Lesson sections">
        {focusStatus !== "" && (
          <p role="status" className="lp-map-status">{focusStatus}</p>
        )}
        <SectionMapList
          entries={entries}
          activeAnchor={activeAnchor}
          onNavigate={onNavigate}
          onSpotlight={onSpotlight}
        />
        <SectionMapFocus onClear={onClear} onExamLighting={onExamLighting} />
      </nav>
      <details className="lp-map lp-map-disclosure">
        <summary>Sections</summary>
        <SectionMapList
          entries={entries}
          activeAnchor={activeAnchor}
          onNavigate={onNavigate}
          onSpotlight={onSpotlight}
        />
        <SectionMapFocus onClear={onClear} onExamLighting={onExamLighting} />
      </details>
    </>
  );
}
