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
  "distractors",
  "drills",
  "examClue",
  "governingRule",
  "heroEpigraph",
  "id",
  "mnemonic",
  "objectiveId",
  "productionNuance",
  "references",
  "reflection",
  "scenarioExpectedAnswer",
  "scenarioOrderItems",
  "scenarioPrompt",
  "sections",
  "slug",
  "title",
  "topicTitle",
  "visual",
].sort();

/** Field names that must never appear anywhere in a brief payload. */
const FORBIDDEN_KEYS = [
  "correctOptionId",
  "rationale",
  "misconceptionId",
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
  scenarioExpectedAnswer: string | null = null,
): Promise<Record<string, unknown>> {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  const facade = new MasteryEngineFacade(engine, manifest, {
    getLessonBrief: () => toLessonBrief(lesson, scenarioExpectedAnswer),
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
    expect(brief["distractors"]).toEqual(
      lesson.distractors.map((distractor) => ({
        choice: distractor.choice,
        whyTempting: distractor.whyTempting,
        whyWrong: distractor.whyWrong,
      })),
    );
    expect(brief["visual"]).toEqual({
      type: lesson.visual.type,
      title: lesson.visual.title,
      steps: lesson.visual.steps,
    });
    expect(brief["drills"]).toEqual({
      recall: lesson.drills.recall,
      connections: lesson.drills.connections,
      application: lesson.drills.application,
      transfer: lesson.drills.transfer,
    });
    expect(brief["reflection"]).toEqual(lesson.reflection);
    expect(brief["scenarioExpectedAnswer"]).toBe(null);
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
    // The brief's key is `scenarioExpectedAnswer`; the exact quoted token
    // `"expectedAnswer"` must stay absent.
    expect(
      `${lesson.slug}:"expectedAnswer":${serialized.includes('"expectedAnswer"')}`,
    ).toBe(`${lesson.slug}:"expectedAnswer":false`);
    for (const secret of withheldStrings(lesson)) {
      expect(`${lesson.slug}:${secret.slice(0, 48)}`).toBe(
        serialized.includes(secret)
          ? `LEAKED ${lesson.slug}:${secret.slice(0, 48)}`
          : `${lesson.slug}:${secret.slice(0, 48)}`,
      );
    }
  });

  test(`the scenario answer reaches the brief only after the page has revealed it — ${lesson.slug}`, async () => {
    const expected = expectedAnswerFor(lesson.slug);
    const pre = await briefPayload(lesson);
    const preBrief = pre["brief"] as Record<string, unknown>;
    expect(preBrief["scenarioExpectedAnswer"]).toBe(null);
    expect(JSON.stringify(pre).includes(expected)).toBe(false);

    const post = await briefPayload(lesson, expected);
    const postBrief = post["brief"] as Record<string, unknown>;
    // this is the symmetry rule, not a leak — the learner is looking at that same text.
    expect(postBrief["scenarioExpectedAnswer"]).toBe(expected);
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
    "lesson.distractors.map",
    "lesson.visual.steps",
    "lesson.visual.type",
    "lesson.visual.title",
    "lesson.drills[key]",
    "lesson.reflection.map",
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
  // The page reveals the expected answer only after the learner commits
  // (still asserted via the post-commit scenario JSON path), and the brief
  // mirrors that gate — onReveal is what feeds the brief.
  expect(source).toContain("/pl-400/scenario/${slug}.json");
  expect(source).toContain("onReveal");
});

test("kickoff opens with an unconditional tool call and anti-refusal clause", () => {
  expect(KICKOFF_PROMPT).toContain("FIRST ACTION, before writing any reply: call get_learner_state");
  expect(KICKOFF_PROMPT).toContain(
    "Never claim the tools are unavailable without having attempted that call",
  );
  expect(KICKOFF_PROMPT).toContain(
    "If an aim is already saved for this lesson, confirm it in one line",
  );
  expect(KICKOFF_PROMPT).toContain("COMMIT FIRST:");
  expect(KICKOFF_PROMPT).toContain('when I demand the answer ("just tell me"), you refuse too');
  expect(KICKOFF_PROMPT).toContain("never draft the commitment for me");
});

test("ISC-77 briefing contract: the kickoff prompt binds grounding and scenario-first", () => {
  expect(KICKOFF_PROMPT).toContain("GROUND: call get_lesson_brief");
  expect(KICKOFF_PROMPT).toContain("not from your own PL-400 knowledge");
  expect(KICKOFF_PROMPT).toContain(
    "Add nothing of your own while a question is open",
  );
  expect(KICKOFF_PROMPT).toContain(
    "mark anything you add from outside the lesson as your own addition",
  );
  expect(KICKOFF_PROMPT).toContain("SCENARIO FIRST:");
  expect(KICKOFF_PROMPT).toContain(
    "establish the scenario in one or two sentences",
  );
  expect(KICKOFF_PROMPT).toContain(
    "Never ask a question that assumes context you have not just given me",
  );
  expect(KICKOFF_PROMPT).toContain("NO RECITING:");
  expect(KICKOFF_PROMPT).toContain(
    "do not restate the lesson's governing rule, exam clue, or mnemonic",
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
  expect(brief).toContain(
    "the authored curriculum you teach from, not your own PL-400 knowledge",
  );
  expect(brief).toContain(
    "never ask a question that assumes context you have not just given them",
  );
  expect(brief).toContain("the distractor teardown the page shows");
  expect(brief).toContain(
    "While a question is unanswered, do not restate the governing rule, exam clue, or mnemonic",
  );
  expect(brief).not.toContain("get_misconception_brief");

  expect(tools.get_current_question.description).toContain("get_lesson_brief");
  expect(tools.get_current_question.description).toContain(
    "never a generic scenario of your own",
  );
  expect(tools.get_current_question.description).toContain(
    "several of them name the correct option almost verbatim",
  );
  expect(tools.get_hint.description).toContain(
    "inside this lesson's own scenario (get_lesson_brief)",
  );
  expect(tools.get_hint.description).toContain(
    "never restate the lesson's governing rule, exam clue, or mnemonic while the question is unanswered",
  );
  expect(tools.get_current_context.description).toContain(
    "each anchor carries the title of the section it names",
  );
});

/**
 * SYMMETRY AUDIT — the design rule as an executable gate, run over every
 * authored lesson: "The agent gets exactly what a learner reading the page
 * gets. No more, no less."
 *
 * Both directions are checked against the LESSON CATALOG rather than against a
 * hand-listed field list, so a future content field cannot pass silently:
 * every string leaf of LessonPageData must reach the brief unless it is named
 * in STRUCTURAL_ONLY below with a reason, and every string in the brief must
 * trace back to the lesson (or to the post-commit reveal).
 */

/** Lesson leaves that are machine identifiers, never prose on the reader's screen. */
const STRUCTURAL_ONLY: { path: string; why: string }[] = [
  {
    path: "topic.id",
    why: "routing key for the topic; the page renders topic.title, never the id",
  },
  {
    path: "questionIds",
    why: "the engine's question scope; the page renders the questions themselves through the live engine, and the ids are answer-key adjacent",
  },
];

function stringLeaves(
  value: unknown,
  path = "",
  out: { path: string; text: string }[] = [],
): { path: string; text: string }[] {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      stringLeaves(item, path, out);
    }
    return out;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      stringLeaves(child, path === "" ? key : `${path}.${key}`, out);
    }
  }
  return out;
}

for (const lesson of lessonPages) {
  test(`symmetry audit: no less — every authored lesson string reaches the brief — ${lesson.slug}`, () => {
    const excluded = new Set(STRUCTURAL_ONLY.map((entry) => entry.path));
    const carried = new Set(
      stringLeaves(toLessonBrief(lesson)).map((leaf) => leaf.text),
    );
    const starved = stringLeaves(lesson)
      .filter((leaf) => !excluded.has(leaf.path))
      .filter((leaf) => !carried.has(leaf.text))
      .map((leaf) => `${leaf.path}: ${leaf.text.slice(0, 60)}`);
    expect(`${lesson.slug} starved: ${starved.join(" | ")}`).toBe(
      `${lesson.slug} starved: `,
    );
  });

  test(`symmetry audit: no more — every brief string traces to the lesson — ${lesson.slug}`, () => {
    const authored = new Set(stringLeaves(lesson).map((leaf) => leaf.text));
    // The titled section anchors are the page's own element ids and headings.
    for (const entry of lessonSectionAnchorEntries(lesson.slug)) {
      authored.add(entry.anchor);
      authored.add(entry.title);
    }
    const revealed = expectedAnswerFor(lesson.slug);
    // Post-commit projection: the reveal is on the learner's screen by then.
    authored.add(revealed);
    const extra = stringLeaves(toLessonBrief(lesson, revealed))
      .filter((leaf) => !authored.has(leaf.text))
      .map((leaf) => `${leaf.path}: ${leaf.text.slice(0, 60)}`);
    expect(`${lesson.slug} extra: ${extra.join(" | ")}`).toBe(
      `${lesson.slug} extra: `,
    );
  });
}

test("the structural-only exclusions are documented and still real fields", () => {
  const lesson = lessonPages[0];
  expect(lesson).toBeDefined();
  const paths = new Set(stringLeaves(lesson).map((leaf) => leaf.path));
  for (const entry of STRUCTURAL_ONLY) {
    // A stale exclusion is a silent widening: if the field is gone, drop the row.
    expect(`${entry.path}:${paths.has(entry.path)}`).toBe(`${entry.path}:true`);
    expect(entry.why.length > 20).toBe(true);
  }
});
