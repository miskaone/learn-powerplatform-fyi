import { describe, expect, test } from "bun:test";
import { DEMO_MASTERY_QUOTE } from "./content";
import { applyFocusPreset, computeDimPlan } from "./focus";
import {
  lessonIndex,
  lessonSectionAnchorEntries,
} from "./lessonIndex";
import { createMasteryStack } from "./masteryStack";

const agentLessHost = { document: {} } as never;

describe("computeDimPlan", () => {
  test('dims every id except the owner ("0","1","2" owner "1" dims 0 and 2)', () => {
    expect(computeDimPlan(["0", "1", "2"], "1")).toEqual([
      { id: "0", dim: true },
      { id: "1", dim: false },
      { id: "2", dim: true },
    ]);
  });

  test("owner not in the block-id list dims every unit", () => {
    expect(computeDimPlan(["0", "1", "2"], "9")).toEqual([
      { id: "0", dim: true },
      { id: "1", dim: true },
      { id: "2", dim: true },
    ]);
  });
});

describe("applyFocusPreset with no DOM", () => {
  test("all three presets return false rather than throw", () => {
    expect(typeof document).toBe("undefined");
    expect(applyFocusPreset("focus-section", "any-anchor")).toBe(false);
    expect(applyFocusPreset("clear-focus", null)).toBe(false);
    expect(applyFocusPreset("exam-lighting", null)).toBe(false);
  });
});

describe("facade setFocus wiring (agent-less)", () => {
  test("unknown-anchor, not-applied, exam-active, and clear-focus reach the applier", () => {
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      expect(
        stack.facade.setFocus("focus-section", "whatever"),
      ).toMatchObject({
        ok: false,
        reason: "unknown-anchor",
      });

      const lesson = lessonIndex[0];
      if (lesson === undefined) {
        throw new Error("lessonIndex is empty");
      }
      const anchors = lessonSectionAnchorEntries(lesson.slug);
      const realAnchor = anchors[0]?.anchor;
      if (realAnchor === undefined) {
        throw new Error("lesson has no section anchors");
      }
      stack.setActiveLesson(lesson.slug);

      expect(stack.facade.setFocus("focus-section", realAnchor)).toEqual({
        ok: false,
        preset: "focus-section",
        anchor: realAnchor,
        reason: "not-applied",
      });

      expect(stack.facade.setFocus("clear-focus")).toEqual({
        ok: false,
        preset: "clear-focus",
        anchor: null,
        reason: "not-applied",
      });

      const current = stack.engine.getCurrentQuestion();
      if (current === null || current.options[0] === undefined) {
        throw new Error("expected a current question with options");
      }
      stack.facade.submitAnswer(current.id, current.options[0].id);
      const entry = { score: 3 as const, evidenceQuote: DEMO_MASTERY_QUOTE };
      const rubric = stack.facade.scoreRubric({
        recall: entry,
        connections: entry,
        application: entry,
        transfer: entry,
      });
      expect(rubric.gatePassed).toBe(true);

      const started = stack.facade.startExam();
      expect(started.active).toBe(true);

      expect(stack.facade.setFocus("exam-lighting")).toMatchObject({
        ok: false,
        reason: "site-managed",
      });
      expect(stack.facade.setFocus("clear-focus").reason).not.toBe(
        "exam-active",
      );
    } finally {
      stack.stopRuntimeDetection();
    }
  });
});
