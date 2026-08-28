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
  scenario: {
    prompt: string;
    expectedAnswer: string;
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
 * Designed micro-lesson pages rendered at /pl-400/[slug].
 * Sourced from content/pl-400/lesson-pages.json — treat this module as a
 * typed loader so page copy and the JSON catalog cannot drift apart.
 */
export const lessonPages: LessonPageData[] =
  lessonPagesJson as LessonPageData[];

export function getLessonPage(slug: string): LessonPageData | undefined {
  return lessonPages.find((page) => page.slug === slug);
}

export function lessonSectionAnchors(slug: string): string[] {
  return [
    `${slug}-rule`,
    `${slug}-exam-clue`,
    `${slug}-scenario`,
    `${slug}-production`,
  ];
}

const ANCHOR_OWNER_BY_ID = new Map<string, string>();
for (const page of lessonPages) {
  for (const anchor of lessonSectionAnchors(page.slug)) {
    ANCHOR_OWNER_BY_ID.set(anchor, page.slug);
  }
}

export function anchorOwnerSlug(anchor: string): string | null {
  return ANCHOR_OWNER_BY_ID.get(anchor) ?? null;
}
