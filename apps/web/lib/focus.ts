/**
 * Stage lighting for coaching. Effects are a FIXED class set — the agent's
 * tool input never reaches CSS; this is the enum-only law.
 */
import type { FocusPreset } from "@learn/mastery-gate/webmcp";
import { scrollToSection } from "./anchor";

export const FOCUS_DIM_CLASS = "fx-dim";
export const EXAM_LIGHTING_CLASS = "fx-exam-lighting";
export const FOCUS_PRESETS = [
  "focus-section",
  "clear-focus",
  "exam-lighting",
] as const;

/** Which of the page's dimmable block ids get FOCUS_DIM_CLASS when ownerId is spotlit: every id except ownerId. */
export function computeDimPlan(
  blockIds: readonly string[],
  ownerId: string,
): { id: string; dim: boolean }[] {
  return blockIds.map((id) => ({ id, dim: id !== ownerId }));
}

const CHROME_CLASSES = ["lp-topbar", "lp-map", "lp-lesson-nav"] as const;
function dimmableUnits(root: Element): Element[] {
  return Array.from(root.children).filter(
    (child) => !CHROME_CLASSES.some((cls) => child.classList.contains(cls)),
  );
}

function clearDimClasses(): void {
  for (const el of document.querySelectorAll("." + FOCUS_DIM_CLASS)) {
    el.classList.remove(FOCUS_DIM_CLASS);
    el.removeAttribute("inert");
  }
}

/** Exam lighting is site-managed: only useMasteryGate's examActive effect may call this. */
export function setExamLighting(on: boolean): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  document.body.classList.toggle(EXAM_LIGHTING_CLASS, on);
  return true;
}

export function applyFocusPreset(
  preset: FocusPreset,
  anchor: string | null,
): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  // clear-focus clears section dims only; exam lighting is owned by the
  // site's examActive effect.
  if (preset === "clear-focus") {
    clearDimClasses();
    return true;
  }

  if (preset === "exam-lighting") {
    // Unreachable through the guarded facade (setFocus refuses the
    // preset as site-managed); kept so the function stays total over
    // FocusPreset.
    clearDimClasses();
    return setExamLighting(true);
  }

  if (anchor === null || anchor === "") {
    return false;
  }
  const target = document.getElementById(anchor);
  const root = document.querySelector(".lp");
  if (!root || !target) {
    return false;
  }
  const units = dimmableUnits(root);
  const ownerIndex = units.findIndex((unit) => unit.contains(target));
  if (ownerIndex === -1) {
    return false;
  }
  const plan = computeDimPlan(
    units.map((_, index) => String(index)),
    String(ownerIndex),
  );
  for (const unit of units) {
    unit.classList.remove(FOCUS_DIM_CLASS);
    unit.removeAttribute("inert");
  }
  for (const step of plan) {
    if (step.dim) {
      // Cross-review finding 8: dimmed content leaves the tab order and the
      // accessibility tree (inert) — a spotlight is semantic, not just visual.
      units[Number(step.id)]?.classList.add(FOCUS_DIM_CLASS);
      units[Number(step.id)]?.setAttribute("inert", "");
    }
  }
  scrollToSection(anchor);
  return true;
}
