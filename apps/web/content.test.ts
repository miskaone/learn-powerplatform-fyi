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
import { KICKOFF_PROMPT } from "./lib/kickoffPrompt";
import { anchorOwnerSlug, lessonSectionAnchors } from "./lib/lessonIndex";
import { getLessonPage } from "./lib/lessonPages";
import { toLessonBrief } from "./lib/lessonBrief";
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

test("the live app manifest supports a full flip-condition drill round", () => {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  const facade = new MasteryEngineFacade(engine, manifest);
  const started = engine.startDrill();
  expect(started.assumptions.length).toBeGreaterThan(0);
  const first = started.assumptions[0];
  const mutated = facade.mutateAssumption(started.scenarioId, first.id);
  expect(mutated.accepted).toBe(true);
  // Reveal refuses before commit — commit-then-reveal is engine-enforced.
  expect(() => facade.revealOutcome(started.scenarioId)).toThrow(
    "prediction-not-committed",
  );
  const committed = facade.commitPrediction(
    started.scenarioId,
    "some outcome",
    "because the flipped assumption changes the tree walk",
  );
  expect(committed.committed).toBe(true);
  const revealed = facade.revealOutcome(started.scenarioId);
  expect(revealed.outcome.length).toBeGreaterThan(0);
  expect(revealed.explanationAnchor.length).toBeGreaterThan(0);
  const results = engine.getDrillResults();
  expect(results.length).toBe(1);
  expect(results[0].dimension).toBe("transfer");
});

test("exam on the live app manifest: mass revocation, submit, debrief tool", () => {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  const facade = new MasteryEngineFacade(engine, manifest, {
    evidenceCorpus: lessonSections.flatMap((section) => [
      section.title,
      ...section.body,
    ]),
  });
  // Prime the gate: one graded attempt, then a passing rubric.
  const first = manifest.questions[0];
  facade.submitAnswer(first.id, first.correctOptionId);
  const entry = { score: 3 as const, evidenceQuote: DEMO_MASTERY_QUOTE };
  facade.scoreRubric({
    recall: entry,
    connections: entry,
    application: entry,
    transfer: entry,
  });
  const status = facade.startExam();
  expect(status.active).toBe(true);
  // The manifest ships an explicit exam form — the exam must NOT fall back
  // to every bank question in the default duration (cross-review MAJOR 9).
  const examConfig = manifest.exam;
  if (examConfig === undefined) {
    throw new Error("manifest.exam is required");
  }
  expect(status.questionsTotal).toBe(examConfig.questionIds.length);
  expect(examConfig.questionIds.length).toBeLessThan(
    manifest.questions.length,
  );
  expect(
    examConfig.durationSeconds / examConfig.questionIds.length,
  ).toBeGreaterThanOrEqual(30);
  // Registry truth mid-exam: only the exam toolset survives.
  const midExam = wouldRegisterToolNames(
    registrySnapshot(
      { phase: "practice", gatePassed: true, misconceptionFires: {} },
      facade,
    ),
  );
  expect([...midExam].sort()).toEqual(["get_exam_status", "submit_exam"]);
  const submitted = facade.submitExam();
  expect(submitted.submitted).toBe(true);
  const postSubmit = wouldRegisterToolNames(
    registrySnapshot(
      { phase: "practice", gatePassed: true, misconceptionFires: {} },
      facade,
    ),
  );
  expect(postSubmit).toContain("get_exam_debrief");
  const debrief = facade.getExamDebrief();
  expect(debrief.scores.recall).toBeGreaterThanOrEqual(3);
  // The submitted exam grades unanswered questions as incorrect; their
  // concepts land in missedConceptIds without leaking option ids.
  expect(debrief.missedConceptIds.length).toBeGreaterThan(0);
  expect(JSON.stringify(debrief)).not.toContain("OptionId");
});

test("lessonSectionAnchors returns the six lesson-page anchors", () => {
  const slug = "delegable-date-window-gallery";
  expect(lessonSectionAnchors(slug)).toEqual([
    `${slug}-rule`,
    `${slug}-exam-clue`,
    `${slug}-scenario`,
    `${slug}-compress`,
    `${slug}-production`,
    `${slug}-run`,
  ]);
});

test("anchorOwnerSlug resolves the compress and run anchors to their lesson", () => {
  const slug = "delegable-date-window-gallery";
  expect(anchorOwnerSlug(`${slug}-compress`)).toBe(slug);
  expect(anchorOwnerSlug(`${slug}-run`)).toBe(slug);
});

test("KICKOFF_PROMPT carries the memory contract and technique lines", () => {
  expect(KICKOFF_PROMPT).toContain(
    "otherwise open with ONE question — why am I here, what do I need this material for?",
  );
  expect(KICKOFF_PROMPT).toContain(
    "MEMORY: You likely already know this learner — use it; ground examples in their real work. Start by reading get_learner_state, including coaching notes from previous sessions. Deposit durable observations via log_coaching_note. Nothing you remember overrules the engine.",
  );
  expect(KICKOFF_PROMPT).toContain(
    "SPACING: At session end, compute when I should return for spaced review (~1 day, then 3 days, then 7 days after material resolves), tell me, and offer to remember it.",
  );
  expect(KICKOFF_PROMPT).toContain(
    "DIFFICULTY: When the site refuses — a withheld answer, a locked hint tier, a closed gate — explain why that friction serves me.",
  );
  expect(KICKOFF_PROMPT).toContain(
    "TRANSFER: Once per lesson, pose one what-if from my own work applying the governing rule.",
  );
});

test("answer-cache guard holds against the cross-review evasions on the REAL manifest", () => {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  // Short CORRECT option ("Azure Function", ml11-q1-a) — below the sliding
  // window, now caught by the token-bounded short-phrase check.
  expect(
    engine.logCoachingNote("when the host question comes up it is Azure Function"),
  ).toEqual({ stored: false, reason: "answer-content" });
  // Punctuation insertion inside the ml13 ordering option must not break the
  // verbatim window (normalization strips punctuation).
  expect(
    engine.logCoachingNote(
      "Regis-ter Permi-ssion Con-sent Conn-ect Ca-ll is the pick",
    ),
  ).toEqual({ stored: false, reason: "answer-content" });
  // Verbatim form still rejected.
  expect(
    engine.logCoachingNote(
      "Register → Permission → Consent → Connect → Call",
    ),
  ).toEqual({ stored: false, reason: "answer-content" });
});

test("answer-cache guard's deliberate boundary: sub-phrase words and free prose still store", () => {
  const engine = new MasteryEngine(manifest, new MemoryStorageAdapter());
  // Single common words ("Blocked", "Filter", "SharePoint") stay unguarded —
  // rejecting every note mentioning them would gut the memory feature. A bare
  // word with no question binding is the documented free-prose residual.
  expect(
    engine.logCoachingNote("learner's org standardized on SharePoint libraries"),
  ).toEqual({ stored: true, reason: null });
  // Free-prose paraphrase keys are OUT OF SCOPE for the deterministic guard
  // (documented residual alongside "agent skips the interview" in the ISA).
  expect(
    engine.logCoachingNote("the webhook host question wants the serverless compute answer"),
  ).toEqual({ stored: true, reason: null });
});

test("ML-13 scenario ships as intro + scrambled order items, and the brief mirrors both", () => {
  const lesson = getLessonPage("entra-graph-connector-order");
  if (lesson === undefined) throw new Error("ML-13 lesson missing");
  expect(lesson.scenario.prompt.endsWith("dependency order:")).toBe(true);
  expect(lesson.scenario.orderItems).toHaveLength(5);
  // never the answer order — the list must not grade itself
  expect(lesson.scenario.orderItems![0]).not.toBe(
    "register a Microsoft Entra application",
  );
  const brief = toLessonBrief(lesson);
  expect(brief.scenarioPrompt.endsWith("dependency order:")).toBe(true);
  expect(brief.scenarioOrderItems).toEqual(lesson.scenario.orderItems);
});
