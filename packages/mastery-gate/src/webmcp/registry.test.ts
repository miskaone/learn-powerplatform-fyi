import { test, expect } from 'bun:test';
import type { DebriefSegment, QuestionPublic } from '../schema';
import type {
  ComposeDebriefResultPublic,
  EngineFacade,
  LearnerStatePublic,
  RegistrySnapshot,
  RubricSubmission,
  SubmitAnswerVerdictPublic,
} from './engine-facade';
import { MockModelContext } from './mock-model-context';
import type { ToolDescriptor, ToolResponse } from './model-context';
import { textResponse } from './model-context';
import { desiredToolNames, ToolRegistry } from './registry';
import { STATIC_TOOL_NAMES } from './tool-names';

const SAMPLE_QUESTION: QuestionPublic = {
  id: 'q-plugin-isolation',
  objectiveId: 'obj-plug-ins',
  concepts: ['IOrganizationService', 'plugin isolation'],
  prompt: 'Which service should a plug-in use to write Dataverse data?',
  options: [
    { id: 'opt-a', text: 'IOrganizationService' },
    { id: 'opt-b', text: 'An outbound HTTP client to the Web API' },
    { id: 'opt-c', text: 'OrganizationDataService' },
  ],
};

const SAMPLE_SCORES = {
  recall: 2,
  connections: 3,
  application: 1,
  transfer: 0,
} as const;

interface EngineLog {
  submitAnswer: { questionId: string; optionId: string } | null;
  scoreRubric: RubricSubmission | null;
  composeDebrief: DebriefSegment[] | null;
  navigateToAnchor: string | null;
}

function createStubEngine(options?: {
  question?: QuestionPublic | null;
  firedMisconceptionIds?: string[];
  submitVerdict?: SubmitAnswerVerdictPublic;
  composeResult?: ComposeDebriefResultPublic;
  learnerState?: LearnerStatePublic;
}): { engine: EngineFacade; log: EngineLog } {
  const log: EngineLog = {
    submitAnswer: null,
    scoreRubric: null,
    composeDebrief: null,
    navigateToAnchor: null,
  };

  const learnerState: LearnerStatePublic = options?.learnerState ?? {
    scores: { ...SAMPLE_SCORES },
    misconceptionFires: {},
    phase: 'practice',
    gatePassed: false,
    attemptCount: 1,
    lessonAims: {},
    ruleCompressions: {},
    runCommitments: {},
  };

  const question =
    options !== undefined &&
    Object.prototype.hasOwnProperty.call(options, 'question')
      ? (options.question ?? null)
      : SAMPLE_QUESTION;

  const engine: EngineFacade = {
    getLearnerState: () => learnerState,
    getCurrentContext: () => ({
      objectiveId: 'obj-plug-ins',
      sectionId: 'sec-plugin-isolation',
      sectionTitle: 'Plugin isolation',
      concepts: ['IOrganizationService'],
      prerequisites: [],
      lesson: null,
    }),
    getCurrentQuestion: () => question,
    submitAnswer: (questionId, optionId) => {
      log.submitAnswer = { questionId, optionId };
      return (
        options?.submitVerdict ?? {
          questionId,
          correct: false,
          misconceptionId: 'mc-http-from-plugin',
          attemptNumber: 1,
          attemptsRemaining: 1,
          rationale: null,
          remediationAnchor: 'lesson-plugin-services',
        }
      );
    },
    getHint: (questionId) => ({
      granted: true,
      tier: 1,
      hint: `Look at the sandbox for ${questionId}`,
      refusal: null,
    }),
    requestNextAction: () => 'hint',
    prescribeDrill: () => ({
      drillKind: 'failure_case',
      targetDimension: 'application',
      rationale: 'Application is the weakest dimension.',
    }),
    scoreRubric: (submission) => {
      log.scoreRubric = submission;
      return {
        accepted: true,
        scores: {
          recall: submission.recall.score,
          connections: submission.connections.score,
          application: submission.application.score,
          transfer: submission.transfer.score,
        },
        gatePassed: false,
        rejectionReason: null,
      };
    },
    setLessonAim: (aim) => ({
      stored: true,
      reason: null,
      lessonKey: 'track',
      value: aim,
    }),
    setRuleCompression: (text) => ({
      stored: true,
      reason: null,
      lessonKey: 'track',
      value: text,
    }),
    setRunCommitment: (text) => ({
      stored: true,
      reason: null,
      lessonKey: 'track',
      value: text,
    }),
    logCoachingNote: (_note) => {
      return;
    },
    navigateToAnchor: (anchor) => {
      log.navigateToAnchor = anchor;
      return { ok: true, anchor };
    },
    getMisconceptionBrief: (misconceptionId) => ({
      id: misconceptionId,
      name: 'HTTP from plugin',
      contrast: 'Plugins use IOrganizationService, not outbound HTTP.',
      socraticSeeds: ['What process hosts the plugin?'],
      anchor: 'lesson-plugin-services',
    }),
    mutateAssumption: (scenarioId, assumptionId) => ({
      accepted: true,
      scenarioId,
      round: 1,
      assumptionText: assumptionId,
    }),
    commitPrediction: (scenarioId) => ({
      committed: true,
      scenarioId,
      refusalReason: null,
    }),
    revealOutcome: () => ({
      outcome: 'sandbox blocks the call',
      predictionWasCorrect: false,
      explanationAnchor: 'lesson-plugin-services',
    }),
    startExam: () => ({
      active: true,
      remainingSeconds: 600,
      questionsAnswered: 0,
      questionsTotal: 4,
      submitted: false,
    }),
    getExamStatus: () => ({
      active: true,
      remainingSeconds: 599,
      questionsAnswered: 0,
      questionsTotal: 4,
      submitted: false,
    }),
    submitExam: () => ({
      active: false,
      remainingSeconds: 0,
      questionsAnswered: 4,
      questionsTotal: 4,
      submitted: true,
    }),
    getExamDebrief: () => ({
      scores: learnerState.scores,
      missedConceptIds: [],
      misconceptionIdsFired: options?.firedMisconceptionIds ?? [],
    }),
    advanceModule: () => ({
      advanced: true,
      nextObjectiveId: 'obj-next',
    }),
    getFiredMisconceptionIds: () => options?.firedMisconceptionIds ?? [],
    composeDebrief: (segments) => {
      log.composeDebrief = segments;
      return (
        options?.composeResult ?? {
          accepted: true,
          rejectedSegmentIds: [],
          reason: null,
        }
      );
    },
    getNarrationScript: () => [
      { segmentId: 'seg-title', order: 0, scriptLine: 'Debrief' },
    ],
    advanceSegment: (segmentId) => ({
      ok: true,
      currentSegmentId: segmentId,
    }),
    getRegistrySnapshot: () => ({
      phase: 'practice',
      gatePassed: false,
      repeatedMisconceptionIds: [],
      predictionCommitted: false,
      examSubmitted: false,
      moduleComplete: false,
    }),
  };

  return { engine, log };
}

function snap(partial: Partial<RegistrySnapshot> = {}): RegistrySnapshot {
  return {
    phase: 'lesson',
    gatePassed: false,
    repeatedMisconceptionIds: [],
    predictionCommitted: false,
    examSubmitted: false,
    moduleComplete: false,
    ...partial,
  };
}

function sortedNames(names: Iterable<string>): string[] {
  return [...names].sort();
}

function textOf(response: ToolResponse): string {
  return response.content[0].text;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

const RICH_FLAGS: Pick<
  RegistrySnapshot,
  'gatePassed' | 'repeatedMisconceptionIds' | 'moduleComplete'
> = {
  gatePassed: true,
  repeatedMisconceptionIds: ['mc-x'],
  moduleComplete: true,
};

test('registry: initial sync in lesson phase registers exactly the STATIC_TOOL_NAMES', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({}));
  const expected = sortedNames(STATIC_TOOL_NAMES);
  expect(sortedNames(registry.getRegisteredNames())).toEqual(expected);
  expect(sortedNames(ctx.getToolNames())).toEqual(expected);
});

test('registry: gate closed then gatePassed registers advance_module and start_exam', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ gatePassed: false }));
  expect(ctx.getToolNames()).not.toContain('advance_module');
  expect(ctx.getToolNames()).not.toContain('start_exam');
  const before = ctx.toolchangeCount;
  await registry.sync(snap({ gatePassed: true }));
  expect(ctx.getToolNames()).toContain('advance_module');
  expect(ctx.getToolNames()).toContain('start_exam');
  expect(ctx.toolchangeCount > before).toBe(true);
});

test('registry: gate passes then regresses revokes advance_module and start_exam', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ gatePassed: true }));
  expect(ctx.getToolNames()).toContain('advance_module');
  expect(ctx.getToolNames()).toContain('start_exam');
  await registry.sync(snap({ gatePassed: false }));
  expect(ctx.getToolNames()).not.toContain('advance_module');
  expect(ctx.getToolNames()).not.toContain('start_exam');
});

test('registry: get_misconception_brief registers after repeated fire and revokes when cleared', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ repeatedMisconceptionIds: [] }));
  expect(ctx.getToolNames()).not.toContain('get_misconception_brief');
  await registry.sync(snap({ repeatedMisconceptionIds: ['mc-x'] }));
  expect(ctx.getToolNames()).toContain('get_misconception_brief');
  await registry.sync(snap({ repeatedMisconceptionIds: [] }));
  expect(ctx.getToolNames()).not.toContain('get_misconception_brief');
});

test('registry: drill tools follow commit-then-reveal and revoke on leaving drill', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ phase: 'drill' }));
  expect(ctx.getToolNames()).toContain('mutate_assumption');
  expect(ctx.getToolNames()).toContain('commit_prediction');
  expect(ctx.getToolNames()).not.toContain('reveal_outcome');
  await registry.sync(snap({ phase: 'drill', predictionCommitted: true }));
  expect(ctx.getToolNames()).toContain('reveal_outcome');
  await registry.sync(snap({ phase: 'practice', predictionCommitted: true }));
  expect(ctx.getToolNames()).not.toContain('mutate_assumption');
  expect(ctx.getToolNames()).not.toContain('commit_prediction');
  expect(ctx.getToolNames()).not.toContain('reveal_outcome');
});

test('registry: exam deregister mode mass-revokes coaching tools then restores after exam', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'exam' }));
  const examOnly = sortedNames(['get_exam_status', 'submit_exam']);
  expect(sortedNames(ctx.getToolNames())).toEqual(examOnly);
  expect(sortedNames((await ctx.getTools()).map((tool) => tool.name))).toEqual(examOnly);
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'exam', examSubmitted: true }));
  expect(ctx.getToolNames()).toContain('get_exam_debrief');
  expect(sortedNames(ctx.getToolNames())).toEqual(
    sortedNames(['get_exam_status', 'submit_exam', 'get_exam_debrief']),
  );
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  const restored = sortedNames([
    ...STATIC_TOOL_NAMES,
    'advance_module',
    'start_exam',
    'get_misconception_brief',
    'compose_debrief',
    'get_narration_script',
    'advance_segment',
  ]);
  expect(sortedNames(ctx.getToolNames())).toEqual(restored);
  expect(sortedNames(registry.getRegisteredNames())).toEqual(restored);
});

test('registry: exam refusal mode keeps coaching tools registered and refuses at execute time', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, { revocationMode: 'refusal' });
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  const priorCoaching = ctx
    .getToolNames()
    .filter(
      (name) =>
        name !== 'start_exam' &&
        name !== 'get_exam_status' &&
        name !== 'submit_exam' &&
        name !== 'get_exam_debrief',
    );
  await registry.sync(snap({ ...RICH_FLAGS, phase: 'exam' }));
  const names = ctx.getToolNames();
  for (const name of priorCoaching) {
    expect(names).toContain(name);
  }
  expect(names).toContain('get_exam_status');
  expect(names).toContain('submit_exam');

  const refused = await ctx.callTool('get_current_question', {});
  const refusedPayload = asRecord(JSON.parse(textOf(refused)));
  expect(refusedPayload['refused']).toBe(true);
  expect(refusedPayload['reason']).toBe('exam-in-progress');

  const examStatus = await ctx.callTool('get_exam_status', {});
  expect(textOf(examStatus)).not.toContain('refused');

  await registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  const question = await ctx.callTool('get_current_question', {});
  expect(textOf(question)).toContain('question');
});

test('registry: identical snapshot sync is idempotent', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  const snapshot = snap({ gatePassed: true, repeatedMisconceptionIds: ['mc-x'] });
  await registry.sync(snapshot);
  const count = ctx.toolchangeCount;
  const names = ctx.getToolNames();
  await registry.sync(snapshot);
  expect(ctx.toolchangeCount).toBe(count);
  expect(ctx.getToolNames()).toEqual(names);
});

test('registry: desiredToolNames lesson default and debrief-ish snapshot', () => {
  expect(sortedNames(desiredToolNames(snap({}), 'deregister'))).toEqual(
    sortedNames(STATIC_TOOL_NAMES),
  );
  const debriefish = desiredToolNames(
    snap({ phase: 'debrief', moduleComplete: true, gatePassed: true }),
    'deregister',
  );
  expect(sortedNames(debriefish)).toEqual(
    sortedNames([
      ...STATIC_TOOL_NAMES,
      'advance_module',
      'start_exam',
      'compose_debrief',
      'get_narration_script',
      'advance_segment',
    ]),
  );
});

test('registry: refusal flag does not leak after returning to practice', async () => {
  const ctx = new MockModelContext();
  const { engine, log } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, { revocationMode: 'refusal' });
  await registry.sync(snap({ phase: 'exam', gatePassed: true }));
  await registry.sync(snap({ phase: 'practice' }));
  await ctx.callTool('submit_answer', { questionId: 'q1', optionId: 'o1' });
  expect(log.submitAnswer).toEqual({ questionId: 'q1', optionId: 'o1' });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function hangingQuestionDescriptor(
  execute: () => Promise<ToolResponse>,
): ToolDescriptor {
  return {
    name: 'get_current_question',
    description: 'Controlled question tool for drain tests',
    inputSchema: { type: 'object', additionalProperties: false },
    execute,
  };
}

async function registerHangingQuestion(options?: {
  drainWarnMs?: number;
  logger?: (message: string) => void;
  onStuckRevocation?: (name: string) => void;
}): Promise<{
  ctx: MockModelContext;
  registry: ToolRegistry;
  deferred: ReturnType<typeof createDeferred<ToolResponse>>;
}> {
  const deferred = createDeferred<ToolResponse>();
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, {
    drainWarnMs: options?.drainWarnMs,
    logger: options?.logger,
    onStuckRevocation: options?.onStuckRevocation,
    toolsetOverride: {
      get_current_question: hangingQuestionDescriptor(() => deferred.promise),
    },
  });
  await registry.sync(snap({}));
  expect(ctx.getToolNames()).toContain('get_current_question');
  return { ctx, registry, deferred };
}

test('revoke during in-flight waits for settlement', async () => {
  const { ctx, registry, deferred } = await registerHangingQuestion();
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  const revoking = registry.sync(snap({ phase: 'exam' }));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 10);
  });
  expect(ctx.getToolNames()).toContain('get_current_question');
  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await revoking;
  expect(ctx.getToolNames()).not.toContain('get_current_question');
});

test('post-drain abort proceeds', async () => {
  const { ctx, registry, deferred } = await registerHangingQuestion();
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  const revoking = registry.sync(snap({ phase: 'exam' }));
  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await revoking;
  expect(ctx.getToolNames()).not.toContain('get_current_question');
  expect(sortedNames(registry.getRegisteredNames())).toEqual(
    sortedNames(ctx.getToolNames()),
  );
});

test('drain timeout warns but never aborts an in-flight registration', async () => {
  const logs: string[] = [];
  const { ctx, registry, deferred } = await registerHangingQuestion({
    drainWarnMs: 20,
    logger: (message) => {
      logs.push(message);
    },
  });
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  const revoking = registry.sync(snap({ phase: 'exam' }));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
  expect(logs.length >= 1).toBe(true);
  expect(logs[0]).toContain('get_current_question');
  expect(logs[0]).toContain('still waiting');
  expect(ctx.getToolNames()).toContain('get_current_question');
  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await revoking;
  expect(ctx.getToolNames()).not.toContain('get_current_question');
});

test('no in-flight revocation aborts immediately', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, { drainWarnMs: 60000 });
  await registry.sync(snap({}));
  expect(ctx.getToolNames()).toContain('get_current_question');
  const started = Date.now();
  await registry.sync(snap({ phase: 'exam' }));
  expect(Date.now() - started).toBeLessThan(1000);
  expect(ctx.getToolNames()).not.toContain('get_current_question');
});

test('registry: disabledTools never register even when desiredToolNames would include them', async () => {
  const ctx = new MockModelContext();
  const registered: string[] = [];
  const originalRegister = ctx.registerTool.bind(ctx);
  ctx.registerTool = (tool, options) => {
    registered.push(tool.name);
    originalRegister(tool, options);
  };
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, {
    disabledTools: ['start_exam', 'mutate_assumption'],
  });
  await registry.sync(snap({ gatePassed: true, phase: 'drill' }));
  expect(registry.getRegisteredNames()).not.toContain('start_exam');
  expect(registry.getRegisteredNames()).not.toContain('mutate_assumption');
  expect(registered).not.toContain('start_exam');
  expect(registered).not.toContain('mutate_assumption');
  expect(registry.getRegisteredNames()).toContain('advance_module');
  expect(registered).toContain('advance_module');
});

test('stuck revocation: never-settling execution fires onStuckRevocation and repeated sync() calls neither hang nor stack', async () => {
  const stuck: string[] = [];
  const logs: string[] = [];
  const { ctx, registry, deferred } = await registerHangingQuestion({
    drainWarnMs: 10,
    logger: (message) => {
      logs.push(message);
    },
    onStuckRevocation: (name) => {
      stuck.push(name);
    },
  });
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  // First sync starts the revocation; it will not settle until the drain
  // does, so it must not be awaited here.
  const firstSync = registry.sync(snap({ phase: 'exam' }));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 40);
  });
  expect(stuck).toEqual(['get_current_question']);
  expect(registry.getStuckRevocations()).toEqual(['get_current_question']);
  expect(logs.some((line) => line.includes('still waiting'))).toBe(true);

  // Later syncs must resolve promptly (no hang) and must reuse the single
  // pending revocation instead of stacking new promises on it.
  for (let i = 0; i < 5; i += 1) {
    await registry.sync(snap({ phase: 'exam' }));
  }
  // Only the one stuck callback ever fires — the revocation is shared.
  expect(stuck).toEqual(['get_current_question']);
  // Drain-first law: the tool is still registered, never aborted in flight.
  expect(ctx.getToolNames()).toContain('get_current_question');

  // Unwedge: once the execution settles, the drain completes, the abort
  // proceeds, and the stuck state clears.
  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await firstSync;
  expect(ctx.getToolNames()).not.toContain('get_current_question');
  expect(registry.getStuckRevocations()).toEqual([]);
});

test('stuck revocation: a tool desired again while draining re-registers after settlement without awaiting the drain', async () => {
  const { ctx, registry, deferred } = await registerHangingQuestion({
    drainWarnMs: 10,
    logger: () => {},
  });
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  void registry.sync(snap({ phase: 'exam' }));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 30);
  });
  expect(registry.getStuckRevocations()).toEqual(['get_current_question']);

  // The tool becomes desired again while its revocation is stuck. sync()
  // must resolve promptly and queue a single post-drain re-sync.
  await registry.sync(snap({}));
  await registry.sync(snap({}));

  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 10);
  });
  // Post-drain re-sync re-registered the tool for the latest snapshot.
  expect(ctx.getToolNames()).toContain('get_current_question');
  expect(registry.getRegisteredNames()).toContain('get_current_question');
  expect(registry.getStuckRevocations()).toEqual([]);
});

test('registry: set_lesson_aim is static in every non-exam phase and revoked in exam deregister mode', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ phase: 'lesson' }));
  expect(ctx.getToolNames()).toContain('set_lesson_aim');
  await registry.sync(snap({ phase: 'practice' }));
  expect(ctx.getToolNames()).toContain('set_lesson_aim');
  await registry.sync(snap({ phase: 'drill' }));
  expect(ctx.getToolNames()).toContain('set_lesson_aim');
  await registry.sync(snap({ phase: 'exam' }));
  expect(ctx.getToolNames()).not.toContain('set_lesson_aim');
  await registry.sync(snap({ phase: 'practice' }));
  expect(ctx.getToolNames()).toContain('set_lesson_aim');
});

test('registry: omitting disabledTools still registers start_exam when gatePassed and phase is not exam', async () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  await registry.sync(snap({ gatePassed: true, phase: 'practice' }));
  expect(registry.getRegisteredNames()).toContain('start_exam');
  expect(ctx.getToolNames()).toContain('start_exam');
});

type PendingRegistration = {
  name: string;
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

function installControlledRegister(ctx: MockModelContext): PendingRegistration[] {
  const pending: PendingRegistration[] = [];
  const originalRegister = ctx.registerTool.bind(ctx);
  ctx.registerTool = (tool, options) => {
    originalRegister(tool, options);
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = () => {
        res();
      };
      reject = (reason) => {
        rej(reason);
      };
    });
    pending.push({ name: tool.name, resolve, reject });
    return promise;
  };
  return pending;
}

test('a stale registerTool rejection does not delete a later live controller', async () => {
  const ctx = new MockModelContext();
  const pending = installControlledRegister(ctx);
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine, {
    logger: () => {
      return;
    },
  });

  const firstSync = registry.sync(snap({ phase: 'practice' }));
  await Promise.resolve();
  const wave1 = pending.splice(0);
  const p1 = wave1.find((entry) => entry.name === 'get_learner_state');
  expect(p1 !== undefined).toBe(true);
  if (p1 === undefined) {
    return;
  }
  for (const entry of wave1) {
    if (entry !== p1) {
      entry.resolve();
    }
  }

  const examSync = registry.sync(snap({ phase: 'exam' }));
  await Promise.resolve();
  for (const entry of pending.splice(0)) {
    entry.resolve();
  }
  await examSync;

  const practiceSync = registry.sync(snap({ phase: 'practice' }));
  await Promise.resolve();
  for (const entry of pending.splice(0)) {
    entry.resolve();
  }
  await practiceSync;
  expect(registry.getRegisteredNames()).toContain('get_learner_state');

  p1.reject(new Error('stale'));
  await Promise.resolve();
  await Promise.resolve();
  expect(registry.getRegisteredNames()).toContain('get_learner_state');
  await firstSync;
});

test('sync resolves only after registerTool settles', async () => {
  let resolveRegistration!: () => void;
  const pending = new Promise<void>((resolve) => {
    resolveRegistration = resolve;
  });
  const ctx = new MockModelContext();
  const originalRegister = ctx.registerTool.bind(ctx);
  ctx.registerTool = (tool, options) => {
    originalRegister(tool, options);
    if (tool.name === 'get_learner_state') {
      return pending;
    }
  };
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  let settled = false;
  const syncing = registry.sync(snap({})).then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  resolveRegistration();
  await syncing;
  expect(settled).toBe(true);
});

test('a new invocation during a draining revocation is refused', async () => {
  const { ctx, registry, deferred } = await registerHangingQuestion();
  const inFlight = ctx.callTool('get_current_question', {});
  await Promise.resolve();
  const revoking = registry.sync(snap({ phase: 'exam' }));
  const refused = await ctx.callTool('get_current_question', {});
  const payload = asRecord(JSON.parse(textOf(refused)));
  expect(payload['refused']).toBe(true);
  expect(payload['reason']).toBe('tool-revoked');
  expect(payload['tool']).toBe('get_current_question');
  deferred.resolve(textResponse({ question: null }));
  await inFlight;
  await revoking;
  expect(registry.getRegisteredNames()).not.toContain('get_current_question');
});
