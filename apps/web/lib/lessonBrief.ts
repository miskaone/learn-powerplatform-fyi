import type { LessonBriefPublic } from "@learn/mastery-gate/webmcp";
import type { LessonPageData } from "./lessonPages";
import { lessonSectionAnchorEntries } from "./lessonIndex";

/**
 * Projects ONE authored lesson into the agent-facing brief — the app layer's
 * half of the grounding contract (the engine package stays content-agnostic).
 *
 * The governing rule of this projection: the agent gets exactly what a
 * learner reading the lesson page gets. Included because the page shows it:
 * title, epigraph, governing rule, exam clue, mnemonic, the scenario PROMPT,
 * the concept hierarchy, production nuance, the titled section anchors, and
 * the references.
 *
 * Structurally omitted, field by field (never spread — adding a field to
 * LessonPageData must never silently widen the brief):
 * - `scenario.expectedAnswer` — it is not on LessonPageData at all. The page
 *   withholds it until the learner commits and then fetches it from
 *   /pl-400/scenario/<slug>.json, so the brief provider cannot reach it even
 *   by accident. Excluded unconditionally rather than gated on commit state:
 *   commit state is per-lesson browser storage the engine does not own, and a
 *   conditional include would make the redaction depend on a surface outside
 *   the engine's guards.
 * - `distractors[]` (choice / whyTempting / whyWrong) — the teardown stays
 *   gated behind an actual misconception fire via get_misconception_brief.
 * - `visual`, `drills`, `reflection` — page prose deliberately left for the
 *   learner's own screen in this pass; the agent routes there with
 *   navigate_to_anchor.
 * Question rationales, correctOptionId, and option→misconception mappings do
 * not exist on LessonPageData in the first place — they live in the manifest
 * the engine grades from.
 */
export function toLessonBrief(lesson: LessonPageData): LessonBriefPublic {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    topicTitle: lesson.topic.title,
    objectiveId: lesson.objectiveId,
    heroEpigraph: lesson.heroEpigraph,
    governingRule: lesson.governingRule,
    examClue: lesson.examClue,
    mnemonic: lesson.mnemonic ?? null,
    scenarioPrompt: lesson.scenario.prompt,
    concepts: lesson.concepts.map((concept) => ({
      id: concept.id,
      label: concept.label,
      importance: concept.importance,
      summary: concept.summary,
    })),
    productionNuance: lesson.productionNuance.map((line) => line),
    sections: lessonSectionAnchorEntries(lesson.slug).map((entry) => ({
      anchor: entry.anchor,
      title: entry.title,
    })),
    references: lesson.references.map((reference) => ({
      label: reference.label,
      url: reference.url,
    })),
  };
}
