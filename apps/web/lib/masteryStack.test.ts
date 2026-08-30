import { describe, expect, test } from "bun:test";
import { MockModelContext } from "@learn/mastery-gate/webmcp";
import { toLessonBrief } from "./lessonBrief";
import { lessonSectionAnchorEntries } from "./lessonIndex";
import { getLessonPage, lessonPages } from "./lessonPages";
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
        objectiveId: "dataverse-extensibility-platform-limits",
        sectionAnchors: lessonSectionAnchorEntries(gallerySlug),
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

  test("getStuckRevocations returns [] with no registry", () => {
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      expect(stack.registry).toBeNull();
      expect(stack.getStuckRevocations()).toEqual([]);
    } finally {
      stack.stopRuntimeDetection();
    }
  });
});

describe("lesson brief provider", () => {
  const agentLessHost = { document: {} } as never;

  function catalogLesson(slug: string) {
    const lesson = getLessonPage(slug);
    if (lesson === undefined) {
      throw new Error(`catalog missing ${slug}`);
    }
    return lesson;
  }

  test("setActiveLesson carries the brief through the stack provider to the facade", () => {
    const lesson = lessonPages[0];
    if (lesson === undefined) {
      throw new Error("catalog is empty");
    }
    const expected = toLessonBrief(lesson);
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lesson.slug, expected);
      const brief = stack.facade.getLessonBrief();
      expect(brief).not.toBeNull();
      expect(brief?.id).toBe(expected.id);
      expect(brief?.slug).toBe(expected.slug);
      expect(brief?.governingRule).toBe(expected.governingRule);
      expect(brief?.distractors).toEqual(expected.distractors);
      expect(brief?.visual.steps).toEqual(expected.visual.steps);
      expect(brief?.drills).toEqual(expected.drills);
      expect(brief?.reflection).toEqual(expected.reflection);
      expect(brief?.sections).toEqual(expected.sections);
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("scenarioOrderItems survives both brief copies (store + facade)", () => {
    // Regression: copyBrief and the facade's getLessonBrief closure are
    // hand-built copies; 7331780 added scenarioOrderItems and both copies
    // silently dropped it until 57550a4.
    const lesson = catalogLesson("entra-graph-connector-order");
    const expected = toLessonBrief(lesson);
    expect(expected.scenarioOrderItems).toHaveLength(5);
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lesson.slug, expected);
      expect(stack.facade.getLessonBrief()?.scenarioOrderItems).toEqual(
        expected.scenarioOrderItems,
      );
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("no brief → the facade reports none", () => {
    const lesson = lessonPages[0];
    if (lesson === undefined) {
      throw new Error("catalog is empty");
    }
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lesson.slug);
      expect(stack.facade.getLessonBrief()).toBeNull();
      stack.setLessonBrief(lesson.slug, toLessonBrief(lesson));
      expect(stack.facade.getLessonBrief()).not.toBeNull();
      expect(stack.facade.getLessonBrief()?.slug).toBe(lesson.slug);
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("setLessonBrief replaces the brief in place without churning the question scope", () => {
    const lesson = lessonPages[0];
    if (lesson === undefined) {
      throw new Error("catalog is empty");
    }
    const revealedText = "REVEALED-SCENARIO-ANSWER";
    let notifies = 0;
    const stack = createMasteryStack(
      () => {
        notifies += 1;
      },
      undefined,
      agentLessHost,
    );
    try {
      stack.setActiveLesson(lesson.slug, toLessonBrief(lesson));
      const notifiesAfterScope = notifies;
      const questionId = stack.facade.getCurrentQuestion()?.id;
      const scope = stack.engine.getQuestionScope();
      stack.setLessonBrief(lesson.slug, toLessonBrief(lesson, revealedText));
      expect(stack.facade.getLessonBrief()?.scenarioExpectedAnswer).toBe(
        revealedText,
      );
      expect(notifies).toBe(notifiesAfterScope);
      expect(stack.engine.getQuestionScope()).toEqual(scope);
      expect(stack.facade.getCurrentQuestion()?.id).toBe(questionId);
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("setLessonBrief ignores a brief for a different lesson", () => {
    const lessonA = catalogLesson("entra-graph-connector-order");
    const lessonB = catalogLesson("webhook-function-etl-boundary");
    const briefA = toLessonBrief(lessonA);
    const briefB = toLessonBrief(lessonB);
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lessonA.slug, briefA);
      stack.setLessonBrief(lessonA.slug, briefB);
      expect(stack.facade.getLessonBrief()?.slug).toBe(lessonA.slug);
      expect(stack.facade.getLessonBrief()?.governingRule).toBe(
        lessonA.governingRule,
      );

      stack.setLessonBrief(lessonB.slug, briefB);
      expect(stack.facade.getLessonBrief()?.slug).toBe(lessonA.slug);
      expect(stack.facade.getLessonBrief()?.governingRule).toBe(
        lessonA.governingRule,
      );
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("setActiveLesson refuses a brief whose slug does not match the lesson", () => {
    const lessonA = catalogLesson("entra-graph-connector-order");
    const lessonB = catalogLesson("webhook-function-etl-boundary");
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lessonA.slug, toLessonBrief(lessonB));
      expect(stack.facade.getLessonBrief()).toBeNull();
      expect(stack.engine.getQuestionScope()).toEqual([...lessonA.questionIds]);
      expect(stack.facade.getCurrentQuestion()?.id).toBe(lessonA.questionIds[0]);
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("the stored brief is a defensive copy — mutating the caller's object cannot change tool output", () => {
    const lesson = lessonPages[0];
    if (lesson === undefined) {
      throw new Error("catalog is empty");
    }
    const brief = toLessonBrief(lesson);
    const authoredWhyWrong = brief.distractors[0]?.whyWrong;
    const authoredDistractorCount = brief.distractors.length;
    const authoredReflectionCount = brief.reflection.length;
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lesson.slug, brief);
      brief.governingRule = "MUTATED";
      brief.distractors.push({
        choice: "MUTATED",
        whyTempting: "MUTATED",
        whyWrong: "MUTATED",
      });
      if (brief.distractors[0] !== undefined) {
        brief.distractors[0].whyWrong = "MUTATED";
      }
      brief.reflection.push("MUTATED");

      const stored = stack.facade.getLessonBrief();
      expect(stored?.governingRule).toBe(lesson.governingRule);
      expect(stored?.distractors.length).toBe(authoredDistractorCount);
      expect(stored?.distractors[0]?.whyWrong).toBe(authoredWhyWrong);
      expect(stored?.reflection.length).toBe(authoredReflectionCount);
    } finally {
      stack.stopRuntimeDetection();
    }
  });

  test("same-slug setActiveLesson replaces the brief when one is supplied", () => {
    const lesson = lessonPages[0];
    if (lesson === undefined) {
      throw new Error("catalog is empty");
    }
    const revealedText = "REVEALED-ON-SAME-SLUG";
    const stack = createMasteryStack(() => {}, undefined, agentLessHost);
    try {
      stack.setActiveLesson(lesson.slug, toLessonBrief(lesson));
      expect(stack.facade.getLessonBrief()?.scenarioExpectedAnswer).toBe(null);
      stack.setActiveLesson(lesson.slug, toLessonBrief(lesson, revealedText));
      expect(stack.facade.getLessonBrief()?.scenarioExpectedAnswer).toBe(
        revealedText,
      );
    } finally {
      stack.stopRuntimeDetection();
    }
  });
});
