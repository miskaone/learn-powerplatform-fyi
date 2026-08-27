import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  FIXTURE_MANIFEST_WITH_DRILLS,
  MasteryEngine,
  MemoryStorageAdapter,
} from "@learn/mastery-gate/engine";
import { MasteryEngineFacade } from "@learn/mastery-gate/webmcp";
import { DEMO_MASTERY_QUOTE, lessonSections, manifest } from "./lib/content";
import {
  QUARANTINED_TOOLS,
  registrySnapshot,
  wouldRegisterToolNames,
} from "./lib/masteryStack";

test("every remediationAnchor and misconception.anchor resolves to a lessonSections id", () => {
  const sectionIds = new Set(lessonSections.map((section) => section.id));
  for (const question of manifest.questions) {
    expect(sectionIds.has(question.remediationAnchor)).toBe(true);
  }
  for (const misconception of manifest.misconceptions) {
    expect(sectionIds.has(misconception.anchor)).toBe(true);
  }
});

test("every lessonSections id appears as a {#id} heading anchor in the lesson markdown", () => {
  const lessonsDir = join(import.meta.dir, "../../content/pl-400/lessons");
  const markdown = readdirSync(lessonsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readFileSync(join(lessonsDir, name), "utf8"))
    .join("\n");
  for (const section of lessonSections) {
    expect(markdown).toContain(`{#${section.id}}`);
  }
});

test("wouldRegisterToolNames includes advance_module and none of QUARANTINED_TOOLS", () => {
  const names = wouldRegisterToolNames(
    registrySnapshot({
      phase: "practice",
      gatePassed: true,
      misconceptionFires: {},
    }),
  );
  expect(names).toContain("advance_module");
  for (const quarantined of QUARANTINED_TOOLS) {
    expect(names).not.toContain(quarantined);
  }
});

test("DEMO_MASTERY_QUOTE is verbatim lesson-body text", () => {
  const bodies = lessonSections.flatMap((section) => section.body);
  expect(
    bodies.some((paragraph) => paragraph.includes(DEMO_MASTERY_QUOTE)),
  ).toBe(true);
});

test("the agent-less mastery demo submission passes the verbatim-corpus check", () => {
  const facade = new MasteryEngineFacade(
    new MasteryEngine(manifest, new MemoryStorageAdapter()),
    manifest,
    {
      evidenceCorpus: lessonSections.flatMap((section) => [
        section.title,
        ...section.body,
      ]),
    },
  );
  // Rubric scoring requires at least one graded attempt on the ledger.
  const first = manifest.questions[0];
  facade.submitAnswer(first.id, first.correctOptionId);
  const entry = { score: 3 as const, evidenceQuote: DEMO_MASTERY_QUOTE };
  const verdict = facade.scoreRubric({
    recall: entry,
    connections: entry,
    application: entry,
    transfer: entry,
  });
  expect(verdict.accepted).toBe(true);
  expect(verdict.gatePassed).toBe(true);
});

test("registrySnapshot maps fires >= 2 to repeatedMisconceptionIds", () => {
  expect(
    registrySnapshot({
      phase: "practice",
      gatePassed: false,
      misconceptionFires: { a: 2, b: 1 },
    }).repeatedMisconceptionIds,
  ).toEqual(["a"]);
});

test("registrySnapshot with a facade reports engine drill truth over UI phase", () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_DRILLS,
    new MemoryStorageAdapter(),
  );
  const facade = new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_DRILLS);
  engine.startDrill("sample-flip-ui");
  facade.mutateAssumption("sample-flip-ui", "ui-root");
  facade.commitPrediction("sample-flip-ui", "Power Pages", "external users");
  const snapshot = registrySnapshot(
    {
      phase: "practice",
      gatePassed: false,
      misconceptionFires: {},
    },
    facade,
  );
  expect(snapshot.predictionCommitted).toBe(true);
  expect(snapshot.phase).toBe("drill");
});
