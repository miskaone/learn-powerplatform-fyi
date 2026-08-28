import { describe, expect, test } from "bun:test";
import { MockModelContext } from "@learn/mastery-gate/webmcp";
import { createMasteryStack, lessonProgress } from "./masteryStack";

const POLL_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("late-binding runtime detection", () => {
  test("no runtime at creation → agent-less; runtime appearing later binds registry and fires callback", async () => {
    const host: { document?: { modelContext?: unknown } } = { document: {} };
    let detected = 0;
    const stack = createMasteryStack(
      () => {},
      () => {
        detected += 1;
      },
      host as never,
    );
    try {
      expect(stack.agentRuntimeDetected).toBe(false);
      expect(stack.registry).toBeNull();
      expect(stack.watcher).toBeNull();

      host.document!.modelContext = new MockModelContext();
      await sleep(POLL_MS + 200);

      expect(stack.agentRuntimeDetected).toBe(true);
      expect(stack.registry).not.toBeNull();
      expect(stack.watcher).not.toBeNull();
      expect(detected).toBe(1);
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });

  test("runtime present at creation binds immediately, no detection loop needed", () => {
    const host = { document: { modelContext: new MockModelContext() } };
    const stack = createMasteryStack(() => {}, undefined, host as never);
    expect(stack.agentRuntimeDetected).toBe(true);
    expect(stack.registry).not.toBeNull();
    stack.stopRuntimeDetection();
    stack.watcher?.stop();
  });

  test("stopRuntimeDetection halts the loop; later injection is not picked up", async () => {
    const host: { document?: { modelContext?: unknown } } = { document: {} };
    const stack = createMasteryStack(() => {}, undefined, host as never);
    stack.stopRuntimeDetection();
    host.document!.modelContext = new MockModelContext();
    await sleep(POLL_MS + 200);
    expect(stack.agentRuntimeDetected).toBe(false);
    expect(stack.registry).toBeNull();
  });
});

describe("active lesson scoping", () => {
  const agentLessHost = { document: {} } as never;
  const gallerySlug = "delegable-date-window-gallery";
  const galleryAnchors = [
    "delegable-date-window-gallery-rule",
    "delegable-date-window-gallery-exam-clue",
    "delegable-date-window-gallery-scenario",
    "delegable-date-window-gallery-production",
  ];

  test("setActiveLesson scopes the current question and lesson context, and is idempotent", () => {
    let notifies = 0;
    const stack = createMasteryStack(
      () => {
        notifies += 1;
      },
      undefined,
      agentLessHost,
    );
    try {
      stack.setActiveLesson(gallerySlug);
      expect(stack.facade.getCurrentQuestion()?.id).toBe("ml14-q1");
      expect(stack.facade.getCurrentContext().lesson).toEqual({
        slug: gallerySlug,
        title: "Build a Delegable Date-Window Gallery",
        sectionAnchors: galleryAnchors,
      });
      expect(notifies).toBe(1);

      stack.setActiveLesson(gallerySlug);
      expect(notifies).toBe(1);

      stack.setActiveLesson(null);
      expect(stack.facade.getCurrentContext().lesson).toBeNull();
      expect(stack.facade.getCurrentQuestion()?.id).toBe("ml13-q1");
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("unknown slug leaves the lesson null and the engine unscoped", () => {
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson("not-a-real-lesson");
      expect(stack.facade.getCurrentContext().lesson).toBeNull();
      expect(stack.engine.getQuestionScope()).toBeNull();
      expect(stack.facade.getCurrentQuestion()?.id).toBe("ml13-q1");
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("lessonProgress on a fresh ledger counts total only", () => {
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      expect(lessonProgress(stack, ["ml14-q1", "ml14-q2"])).toEqual({
        attempted: 0,
        correct: 0,
        total: 2,
      });
    } finally {
      stack.stopRuntimeDetection();
    }
  });
});
