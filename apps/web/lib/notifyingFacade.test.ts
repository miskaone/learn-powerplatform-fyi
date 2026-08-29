import { expect, test } from "bun:test";
import type { EngineFacade } from "@learn/mastery-gate/webmcp";
import { NotifyingFacade } from "./notifyingFacade";

class InnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InnerError";
  }
}

const STATE = {
  scores: { recall: 0, connections: 0, application: 0, transfer: 0 },
  misconceptionFires: {},
  phase: "practice",
  gatePassed: false,
  attemptCount: 0,
  lessonAims: {},
  ruleCompressions: {},
  runCommitments: {},
  coachingNotes: [],
  coachCalibration: null,
} as const;

const EXAM_STATUS = {
  active: true,
  remainingSeconds: 600,
  questionsAnswered: 0,
  questionsTotal: 4,
  submitted: false,
} as const;

function succeedingFacade(): EngineFacade {
  return {
    getLearnerState: () => ({
      ...STATE,
      misconceptionFires: {},
      lessonAims: {},
      ruleCompressions: {},
      runCommitments: {},
      coachingNotes: [...STATE.coachingNotes],
    }),
    getCurrentContext: () => ({
      objectiveId: "obj",
      sectionId: "sec",
      sectionTitle: "Section",
      concepts: [],
      prerequisites: [],
      lesson: null,
    }),
    getLessonBrief: () => null,
    getCurrentQuestion: () => null,
    submitAnswer: (questionId) => ({
      questionId,
      correct: true,
      misconceptionId: null,
      attemptNumber: 1,
      attemptsRemaining: 1,
      rationale: null,
      remediationAnchor: null,
      defeatedMisconception: null,
    }),
    getHint: () => ({ granted: false, tier: null, hint: null, refusal: "x" }),
    requestNextAction: () => "continue",
    prescribeDrill: () => ({
      drillKind: "spaced_review",
      targetDimension: "recall",
      rationale: "r",
    }),
    scoreRubric: () => ({
      accepted: false,
      scores: { ...STATE.scores },
      gatePassed: false,
      rejectionReason: "r",
    }),
    setLessonAim: (aim) => ({
      stored: true,
      reason: null,
      lessonKey: "track",
      value: aim,
    }),
    setRuleCompression: (text) => ({
      stored: true,
      reason: null,
      lessonKey: "track",
      value: text,
    }),
    setRunCommitment: (text) => ({
      stored: true,
      reason: null,
      lessonKey: "track",
      value: text,
    }),
    logCoachingNote: () => ({ stored: true, reason: null }),
    navigateToAnchor: (anchor) => ({ ok: true, anchor }),
    getMisconceptionBrief: () => null,
    mutateAssumption: (scenarioId) => ({
      accepted: true,
      scenarioId,
      round: 1,
      assumptionText: "a",
    }),
    commitPrediction: (scenarioId) => ({
      committed: true,
      scenarioId,
      refusalReason: null,
    }),
    revealOutcome: () => ({
      outcome: "o",
      predictionWasCorrect: true,
      explanationAnchor: "sec",
    }),
    startExam: () => ({ ...EXAM_STATUS }),
    getExamStatus: () => ({ ...EXAM_STATUS }),
    submitExam: () => ({ ...EXAM_STATUS, submitted: true }),
    getExamDebrief: () => ({
      scores: { ...STATE.scores },
      missedConceptIds: [],
      misconceptionIdsFired: [],
    }),
    advanceModule: () => ({ advanced: false, nextObjectiveId: null }),
    getFiredMisconceptionIds: () => [],
    composeDebrief: () => ({
      accepted: true,
      rejectedSegmentIds: [],
      reason: null,
    }),
    getNarrationScript: () => [],
    advanceSegment: (segmentId) => ({ ok: true, currentSegmentId: segmentId }),
    getRegistrySnapshot: () => ({
      phase: "practice",
      gatePassed: false,
      repeatedMisconceptionIds: [],
      predictionCommitted: false,
      examSubmitted: false,
      moduleComplete: false,
    }),
  };
}

type Invoke = (facade: EngineFacade) => unknown;

/** The mutating methods that must notify on success (cross-review finding 9b). */
const MUTATING_METHODS: ReadonlyArray<[keyof EngineFacade, Invoke]> = [
  ["submitAnswer", (f) => f.submitAnswer("q1", "o1")],
  ["getHint", (f) => f.getHint("q1")],
  ["scoreRubric", (f) => f.scoreRubric({} as never)],
  ["logCoachingNote", (f) => f.logCoachingNote("note")],
  ["advanceModule", (f) => f.advanceModule()],
  // The seven added by finding 9b — agent-driven Day-2 transitions must
  // resync registry + UI:
  ["startExam", (f) => f.startExam()],
  ["submitExam", (f) => f.submitExam()],
  ["mutateAssumption", (f) => f.mutateAssumption("s1", "a1")],
  ["commitPrediction", (f) => f.commitPrediction("s1", "p", "because")],
  ["revealOutcome", (f) => f.revealOutcome("s1")],
  ["composeDebrief", (f) => f.composeDebrief([])],
  ["advanceSegment", (f) => f.advanceSegment("seg-1")],
];

test("every mutating facade method notifies exactly once on success", () => {
  for (const [name, invoke] of MUTATING_METHODS) {
    let notifications = 0;
    const facade = new NotifyingFacade(succeedingFacade(), () => {
      notifications += 1;
    });
    invoke(facade);
    expect(`${String(name)}:${notifications}`).toBe(`${String(name)}:1`);
  }
});

test("a facade method that throws does NOT notify", () => {
  for (const [name, invoke] of MUTATING_METHODS) {
    let notifications = 0;
    const inner = succeedingFacade();
    (inner as unknown as Record<string, unknown>)[name as string] = () => {
      throw new InnerError(String(name));
    };
    const facade = new NotifyingFacade(inner, () => {
      notifications += 1;
    });
    expect(() => invoke(facade)).toThrow(InnerError);
    expect(`${String(name)}:${notifications}`).toBe(`${String(name)}:0`);
  }
});

test("read-only facade methods never notify", () => {
  let notifications = 0;
  const facade = new NotifyingFacade(succeedingFacade(), () => {
    notifications += 1;
  });
  facade.getLearnerState();
  facade.getCurrentContext();
  facade.getLessonBrief();
  facade.getCurrentQuestion();
  facade.requestNextAction();
  facade.prescribeDrill();
  facade.navigateToAnchor("sec");
  facade.getMisconceptionBrief("mc");
  facade.getExamStatus();
  facade.getExamDebrief();
  facade.getFiredMisconceptionIds();
  facade.getNarrationScript();
  facade.getRegistrySnapshot();
  expect(notifications).toBe(0);
});

test("lesson-text setters notify once when stored and never when refused", () => {
  const methods: ReadonlyArray<
    [
      "setLessonAim" | "setRuleCompression" | "setRunCommitment",
      (facade: EngineFacade) => unknown,
    ]
  > = [
    ["setLessonAim", (f) => f.setLessonAim("aim")],
    ["setRuleCompression", (f) => f.setRuleCompression("rule")],
    ["setRunCommitment", (f) => f.setRunCommitment("commit")],
  ];

  for (const [name, invoke] of methods) {
    let storedNotifications = 0;
    const storedInner = succeedingFacade();
    const storedFacade = new NotifyingFacade(storedInner, () => {
      storedNotifications += 1;
    });
    invoke(storedFacade);
    expect(`${name}:stored:${storedNotifications}`).toBe(`${name}:stored:1`);

    let refusedNotifications = 0;
    const refusedInner = succeedingFacade();
    (refusedInner as unknown as Record<string, unknown>)[name] = () => ({
      stored: false,
      reason: "exam-active",
      lessonKey: "track",
      value: null,
    });
    const refusedFacade = new NotifyingFacade(refusedInner, () => {
      refusedNotifications += 1;
    });
    invoke(refusedFacade);
    expect(`${name}:refused:${refusedNotifications}`).toBe(
      `${name}:refused:0`,
    );
  }
});

test("logCoachingNote passes kind through and notifies only when stored", () => {
  let storedNotifications = 0;
  const storedCalls: Array<{
    note: string;
    kind?: "observation" | "preference" | "context";
  }> = [];
  const storedInner = succeedingFacade();
  storedInner.logCoachingNote = (note, kind) => {
    storedCalls.push({ note, kind });
    return { stored: true, reason: null };
  };
  const storedFacade = new NotifyingFacade(storedInner, () => {
    storedNotifications += 1;
  });
  expect(
    storedFacade.logCoachingNote("prefers worked examples first", "preference"),
  ).toEqual({ stored: true, reason: null });
  expect(storedCalls).toEqual([
    { note: "prefers worked examples first", kind: "preference" },
  ]);
  expect(storedNotifications).toBe(1);

  let refusedNotifications = 0;
  const refusedInner = succeedingFacade();
  refusedInner.logCoachingNote = () => ({
    stored: false,
    reason: "answer-content",
  });
  const refusedFacade = new NotifyingFacade(refusedInner, () => {
    refusedNotifications += 1;
  });
  expect(
    refusedFacade.logCoachingNote("ml13-q1 was hard", "observation"),
  ).toEqual({ stored: false, reason: "answer-content" });
  expect(refusedNotifications).toBe(0);
});

test("getRegistrySnapshot passes through without notifying", () => {
  let notifications = 0;
  const inner = succeedingFacade();
  const facade = new NotifyingFacade(inner, () => {
    notifications += 1;
  });
  expect(facade.getRegistrySnapshot()).toEqual(inner.getRegistrySnapshot());
  expect(notifications).toBe(0);
});
