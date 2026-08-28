import type { LessonBriefPublic } from "@learn/mastery-gate/webmcp";
import type { LessonPageData } from "./lessonPages";
import { lessonSectionAnchorEntries } from "./lessonIndex";

/**
 * Projects ONE authored lesson into the agent-facing brief — the app layer's
 * half of the grounding contract (the engine package stays content-agnostic).
 *
 * The agent gets exactly what a learner reading the page gets. No more, no less.
 *
 * Included because the page renders it: title, epigraph, governing rule, exam
 * clue, mnemonic, the scenario prompt, the concept hierarchy, the distractor
 * teardown (choice / whyTempting / whyWrong), the visual walkthrough, production
 * nuance, the four targeted drills, the reflection prompts, the titled section
 * anchors, and the references.
 *
 * scenarioExpectedAnswer is commit-gated symmetry: the page withholds it until
 * the learner commits and then shows it, so the brief carries null until the
 * app layer hands over the revealed text. It is never prerendered — it ships as
 * a post-commit /pl-400/scenario/<slug>.json fetch.
 *
 * Question rationales, correctOptionId, and option->misconception mappings do
 * not exist on LessonPageData at all — they live in the manifest the engine
 * grades from. Field-by-field copy only (never spread): adding a field to
 * LessonPageData must never silently widen the brief.
 */
export function toLessonBrief(
  lesson: LessonPageData,
  scenarioExpectedAnswer: string | null = null,
): LessonBriefPublic {
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
    scenarioExpectedAnswer,
    distractors: lesson.distractors.map((distractor) => ({
      choice: distractor.choice,
      whyTempting: distractor.whyTempting,
      whyWrong: distractor.whyWrong,
    })),
    visual: {
      type: lesson.visual.type,
      title: lesson.visual.title,
      steps: lesson.visual.steps.map((step) => ({
        label: step.label,
        state: step.state,
        detail: step.detail,
      })),
    },
    drills: {
      recall: lesson.drills.recall,
      connections: lesson.drills.connections,
      application: lesson.drills.application,
      transfer: lesson.drills.transfer,
    },
    reflection: lesson.reflection.map((line) => line),
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
