import { expect, test } from "bun:test";
import { deriveContinueTarget } from "./continueTarget";
import { lessonIndex } from "./lessonIndex";
import { createMasteryStack, lessonProgress } from "./masteryStack";

const agentLessHost = { document: {} } as never;

test("fresh ledger (no attempts) hides the continue target", () => {
  const stack = createMasteryStack(() => {}, undefined, agentLessHost);
  try {
    expect(
      deriveContinueTarget(stack.engine.getLatestAttempt(), (ids) =>
        lessonProgress(stack, ids).attempted,
      ),
    ).toBeNull();
  } finally {
    stack.stopRuntimeDetection();
  }
});

test("latest attempt maps to its owning lesson (lesson 2 / 02)", () => {
  const stack = createMasteryStack(() => {}, undefined, agentLessHost);
  try {
    const lesson = lessonIndex[1];
    if (lesson === undefined) {
      throw new Error("lessonIndex[1] is missing");
    }
    stack.setActiveLesson(lesson.slug);
    const current = stack.engine.getCurrentQuestion();
    if (current === null || current.options[0] === undefined) {
      throw new Error("expected a current question with options");
    }
    expect(lesson.questionIds).toContain(current.id);
    stack.facade.submitAnswer(current.id, current.options[0].id);

    expect(
      deriveContinueTarget(stack.engine.getLatestAttempt(), (ids) =>
        lessonProgress(stack, ids).attempted,
      ),
    ).toEqual({
      slug: lesson.slug,
      title: lesson.title,
      number: "02",
    });
  } finally {
    stack.stopRuntimeDetection();
  }
});

test("unmapped question falls back to the first lesson with zero attempts", () => {
  const first = lessonIndex[0];
  const second = lessonIndex[1];
  if (first === undefined || second === undefined) {
    throw new Error("lessonIndex is too short");
  }
  const target = deriveContinueTarget({ questionId: "no-such-question" }, (ids) =>
    ids[0] === first.questionIds[0] ? 5 : 0,
  );
  expect(target).toEqual({
    slug: second.slug,
    title: second.title,
    number: "02",
  });
});

test("unmapped question with every lesson started suggests nothing", () => {
  expect(
    deriveContinueTarget({ questionId: "no-such-question" }, () => 5),
  ).toBeNull();
});

test("finding 6 regression: a fully-attempted lesson advances to the next incomplete", () => {
  const first = lessonIndex[0]!;
  const second = lessonIndex[1]!;
  const target = deriveContinueTarget(
    { questionId: first.questionIds[0]! },
    (ids) => (ids === first.questionIds ? first.questionIds.length : 0),
  );
  expect(target?.slug).toBe(second.slug);
});

test("finding 6 regression: all lessons fully attempted -> null", () => {
  const target = deriveContinueTarget(
    { questionId: lessonIndex[0]!.questionIds[0]! },
    (ids) => ids.length,
  );
  expect(target).toBeNull();
});

test("finding 6 regression: mid-lesson stays on that lesson", () => {
  const first = lessonIndex[0]!;
  const target = deriveContinueTarget(
    { questionId: first.questionIds[0]! },
    (ids) => (ids === first.questionIds ? 1 : 0),
  );
  expect(target?.slug).toBe(first.slug);
});
