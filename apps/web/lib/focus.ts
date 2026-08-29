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

function dimmableUnits(root: Element): Element[] {
  return Array.from(root.children).filter(
    (child) => !child.classList.contains("lp-topbar"),
  );
}

function clearDimClasses(): void {
  for (const el of document.querySelectorAll("." + FOCUS_DIM_CLASS)) {
    el.classList.remove(FOCUS_DIM_CLASS);
  }
}

export function applyFocusPreset(
  preset: FocusPreset,
  anchor: string | null,
): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (preset === "clear-focus") {
    clearDimClasses();
    document.body.classList.remove(EXAM_LIGHTING_CLASS);
    return true;
  }

  if (preset === "exam-lighting") {
    clearDimClasses();
    document.body.classList.add(EXAM_LIGHTING_CLASS);
    return true;
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
  }
  for (const step of plan) {
    if (step.dim) {
      units[Number(step.id)]?.classList.add(FOCUS_DIM_CLASS);
    }
  }
  scrollToSection(anchor);
  return true;
}
