import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { MasteryEngine, MemoryStorageAdapter } from "@learn/mastery-gate/engine";
import { MasteryEngineFacade, createToolset } from "@learn/mastery-gate/webmcp";
import { manifest } from "./lib/content";
import { KICKOFF_PROMPT } from "./lib/kickoffPrompt";
import { toLessonBrief } from "./lib/lessonBrief";
import { anchorOwnerSlug, lessonSectionAnchorEntries } from "./lib/lessonIndex";
import { lessonPages, type LessonPageData } from "./lib/lessonPages";

/**
 * ISC-76 leak battery — run against EVERY authored lesson in the manifest,
 * through the real tool (not just the projection function), because the tool
 * response is what the agent actually receives.
 *
 * The governing rule under test: the agent gets exactly what a learner
 * reading the page gets. Authored prose in; everything the page withholds
 * from its reader stays out.
 */

const BRIEF_KEYS = [
  "concepts",
  "examClue",
  "governingRule",
  "heroEpigraph",
  "id",
  "mnemonic",
  "objectiveId",
  "productionNuance",
  "references",
  "scenarioPrompt",
  "sections",
  "slug",
  "title",
  "topicTitle",
].sort();

/** Field names that must never appear anywhere in a brief payload. */
const FORBIDDEN_KEYS = [
  "expectedAnswer",
  "correctOptionId",
  "rationale",
  "misconceptionId",
  "distractors",
  "whyTempting",
  "whyWrong",
  "options",
  "dimension",
  "remediationAnchor",
];

function expectedAnswerFor(slug: string): string {
  const raw = readFileSync(
    join(import.meta.dir, "public/pl-400/scenario", `${slug}.json`),
    "utf8",
  );
  const parsed = JSON.parse(raw) as { expectedAnswer?: unknown };
  if (typeof parsed.expectedAnswer !== "string") {
    throw new Error(`scenario ${slug} has no expectedAnswer to guard against`);
  }
  return parsed.expectedAnswer;
}

/** Everything the lesson page withholds from its own reader, per lesson. */
function withheldStrings(lesson: LessonPageData): string[] {
  const withheld: string[] = [expectedAnswerFor(lesson.slug)];
  for (const distractor of lesson.distractors) {
    withheld.push(distractor.whyTempting, distractor.whyWrong);
  }
  const questionIds = new Set(lesson.questionIds);
  const misconceptionIds = new Set<string>();
  for (const question of manifest.questions) {
    if (!questionIds.has(question.id)) {
      continue;
    }
    withheld.push(question.rationale, question.correctOptionId, question.id);
    for (const option of question.options) {
      withheld.push(option.id);
      if (option.misconceptionId !== undefined) {
        misconceptionIds.add(option.misconceptionId);
      }
    }
  }
  for (const misconception of manifest.misconceptions) {
    if (!misconceptionIds.has(misconception.id)) {
      continue;
    }
    withheld.push(misconception.contrast, ...misconception.socraticSeeds);
  }
  return withheld;
}

/** Runs the real tool with this lesson active and returns the JSON payload. */
async function briefPayload(
  lesson: LessonPageData,
): Promise<Record<string, unknown>> {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  const facade = new MasteryEngineFacade(engine, manifest, {
    getLessonBrief: () => toLessonBrief(lesson),
  });
  const tools = createToolset(facade);
  const response = await tools.get_lesson_brief.execute({});
  return JSON.parse(response.content[0].text) as Record<string, unknown>;
}

test("every authored lesson has a scenario answer to be guarded against", () => {
  expect(lessonPages.length > 0).toBe(true);
  for (const lesson of lessonPages) {
    expect(expectedAnswerFor(lesson.slug).length > 0).toBe(true);
  }
});

for (const lesson of lessonPages) {
  test(`get_lesson_brief carries the authored lesson verbatim — ${lesson.slug}`, async () => {
    const payload = await briefPayload(lesson);
    const brief = payload["brief"] as Record<string, unknown>;

    expect(Object.keys(brief).sort()).toEqual(BRIEF_KEYS);
    expect(brief["id"]).toBe(lesson.id);
    expect(brief["slug"]).toBe(lesson.slug);
    expect(brief["title"]).toBe(lesson.title);
    expect(brief["topicTitle"]).toBe(lesson.topic.title);
    expect(brief["objectiveId"]).toBe(lesson.objectiveId);
    expect(brief["heroEpigraph"]).toBe(lesson.heroEpigraph);
    expect(brief["governingRule"]).toBe(lesson.governingRule);
    expect(brief["examClue"]).toBe(lesson.examClue);
    expect(brief["mnemonic"]).toBe(lesson.mnemonic ?? null);
    expect(brief["scenarioPrompt"]).toBe(lesson.scenario.prompt);
    expect(brief["concepts"]).toEqual(
      lesson.concepts.map((concept) => ({
        id: concept.id,
        label: concept.label,
        importance: concept.importance,
        summary: concept.summary,
      })),
    );
    expect(brief["productionNuance"]).toEqual(lesson.productionNuance);
    expect(brief["references"]).toEqual(lesson.references);
    expect(brief["sections"]).toEqual(lessonSectionAnchorEntries(lesson.slug));
    for (const section of lessonSectionAnchorEntries(lesson.slug)) {
      expect(anchorOwnerSlug(section.anchor)).toBe(lesson.slug);
      expect(section.title.length > 0).toBe(true);
    }
  });

  test(`get_lesson_brief leaks nothing the page withholds — ${lesson.slug}`, async () => {
    const payload = await briefPayload(lesson);
    const serialized = JSON.stringify(payload);

    for (const key of FORBIDDEN_KEYS) {
      expect(`${lesson.slug}:${key}:${serialized.includes(`"${key}"`)}`).toBe(
        `${lesson.slug}:${key}:false`,
      );
    }
    for (const secret of withheldStrings(lesson)) {
      expect(`${lesson.slug}:${secret.slice(0, 48)}`).toBe(
        serialized.includes(secret)
          ? `LEAKED ${lesson.slug}:${secret.slice(0, 48)}`
          : `${lesson.slug}:${secret.slice(0, 48)}`,
      );
    }
  });
}

test("agent-less parity: every field the brief carries is already rendered on the lesson page", () => {
  const source = readFileSync(
    join(import.meta.dir, "components/LessonPage.tsx"),
    "utf8",
  );
  // The page has always rendered all of this prose — grounding the agent adds
  // no UI work, it only stops starving the agent of what the reader can see.
  for (const rendered of [
    "lesson.title",
    "lesson.topic.title",
    "lesson.heroEpigraph",
    "lesson.governingRule",
    "lesson.examClue",
    "lesson.mnemonic",
    "lesson.scenario.prompt",
    "lesson.concepts.map",
    "lesson.productionNuance.map",
    "lesson.references.map",
  ]) {
    expect(`${rendered}:${source.includes(rendered)}`).toBe(`${rendered}:true`);
  }
  // …and every titled anchor the brief hands out is an id the page renders.
  for (const suffix of [
    "-rule",
    "-exam-clue",
    "-scenario",
    "-production",
    "-compress",
    "-run",
  ]) {
    expect(`${suffix}:${source.includes(`\${lesson.slug}${suffix}`)}`).toBe(
      `${suffix}:true`,
    );
  }
  // The page withholds the scenario answer from its reader until they commit;
  // the brief withholds it unconditionally.
  expect(source).toContain("/pl-400/scenario/${slug}.json");
});

test("ISC-77 briefing contract: the kickoff prompt binds grounding and scenario-first", () => {
  expect(KICKOFF_PROMPT).toContain("GROUND: call get_lesson_brief");
  expect(KICKOFF_PROMPT).toContain(
    "not from your own PL-400 knowledge",
  );
  expect(KICKOFF_PROMPT).toContain("mark as your own addition");
  expect(KICKOFF_PROMPT).toContain("SCENARIO FIRST:");
  expect(KICKOFF_PROMPT).toContain(
    "establish the scenario in one or two sentences",
  );
  expect(KICKOFF_PROMPT).toContain(
    "Never ask a question that assumes context you have not just given me",
  );
});

test("ISC-77 briefing contract: the tool descriptions carry it too", () => {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  const facade = new MasteryEngineFacade(engine, manifest, {
    getLessonBrief: () => toLessonBrief(lessonPages[0]),
  });
  const tools = createToolset(facade);

  const brief = tools.get_lesson_brief.description;
  expect(brief).toContain("before you begin coaching a lesson");
  expect(brief).toContain("whenever the learner moves to a new lesson");
  expect(brief).toContain("prefer it over your own knowledge");
  expect(brief).toContain(
    "never ask a question that assumes context you have not just given them",
  );

  expect(tools.get_current_question.description).toContain("get_lesson_brief");
  expect(tools.get_current_question.description).toContain(
    "never a generic scenario of your own",
  );
  expect(tools.get_hint.description).toContain(
    "inside this lesson's own scenario (get_lesson_brief)",
  );
  expect(tools.get_current_context.description).toContain(
    "each anchor carries the title of the section it names",
  );
});
