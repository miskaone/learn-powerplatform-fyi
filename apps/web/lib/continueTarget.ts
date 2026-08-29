import { lessonForQuestion, lessonIndex, type LessonIndexEntry } from "./lessonIndex";

export interface ContinueTarget {
  slug: string;
  title: string;
  /** 1-based position in the lesson index, zero-padded: "01".."05". */
  number: string;
}

function toContinueTarget(entry: LessonIndexEntry): ContinueTarget {
  const position = lessonIndex.findIndex((lesson) => lesson.slug === entry.slug);
  return {
    slug: entry.slug,
    title: entry.title,
    number: String(position + 1).padStart(2, "0"),
  };
}

/**
 * Hub "continue where you left off" derivation. latestAttempt comes from
 * engine.getLatestAttempt(); attemptedFor reports how many of a lesson's
 * questions have ledger attempts (lessonProgress(stack, ids).attempted).
 * Fresh ledger (latestAttempt null) → null: the button hides.
 * Latest attempt's question maps to its owning lesson; if it maps to no
 * lesson, fall back to the first lesson with zero attempts; if every
 * lesson is started, fall back to the owning-lesson-less latest attempt's
 * answer of "nothing to suggest" → null.
 */
export function deriveContinueTarget(
  latestAttempt: { questionId: string } | null,
  attemptedFor: (questionIds: readonly string[]) => number,
): ContinueTarget | null {
  if (latestAttempt === null) {
    return null;
  }
  const mapped = lessonForQuestion(latestAttempt.questionId);
  if (mapped !== null) {
    return toContinueTarget(mapped);
  }
  for (const entry of lessonIndex) {
    if (attemptedFor(entry.questionIds) === 0) {
      return toContinueTarget(entry);
    }
  }
  return null;
}
