import lessonPagesJson from "../../../content/pl-400/lesson-pages.json";

export interface LessonPageData {
  id: string;
  slug: string;
  title: string;
  topic: {
    id: string;
    title: string;
  };
  objectiveId: string;
  questionIds: string[];
  heroEpigraph: string;
  governingRule: string;
  examClue: string;
  mnemonic?: string;
  /**
   * The scenario's expected answer is deliberately NOT here (cross-review
   * finding 7): it ships as /pl-400/scenario/<slug>.json and is fetched only
   * after the learner commits, so the prerendered page never carries the
   * answer to its own commit gate.
   */
  scenario: {
    prompt: string;
  };
  concepts: {
    id: string;
    label: string;
    importance: string;
    summary: string;
  }[];
  distractors: {
    choice: string;
    whyTempting: string;
    whyWrong: string;
  }[];
  productionNuance: string[];
  visual: {
    type: string;
    title: string;
    steps: {
      label: string;
      state: string;
      detail: string;
    }[];
  };
  drills: {
    recall: string;
    connections: string;
    application: string;
    transfer: string;
  };
  reflection: string[];
  references: {
    label: string;
    url: string;
  }[];
}

/**
 * Full designed micro-lesson catalog rendered at /pl-400/[slug].
 * SERVER-COMPONENT USE ONLY: importing this from client code drags the whole
 * teaching catalog into the shared JS chunk (cross-review finding 8). Client
 * modules that need routing/scoping data import ./lessonIndex instead; the
 * lesson template receives exactly one lesson via props.
 * Sourced from content/pl-400/lesson-pages.json — a typed loader so page copy
 * and the JSON catalog cannot drift apart.
 */
export const lessonPages: LessonPageData[] =
  lessonPagesJson as LessonPageData[];

export function getLessonPage(slug: string): LessonPageData | undefined {
  return lessonPages.find((page) => page.slug === slug);
}
