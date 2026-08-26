import { test, expect } from 'bun:test';
import type { DebriefSegment, QuestionPublic } from '../schema';
import type {
  ComposeDebriefResultPublic,
  EngineFacade,
  LearnerStatePublic,
  RubricSubmission,
  SubmitAnswerVerdictPublic,
} from './engine-facade';
import { MockModelContext } from './mock-model-context';
import type { ToolResponse } from './model-context';
import {
  desiredToolNames,
  ToolRegistry,
  type RegistrySnapshot,
} from './registry';
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

test('registry: initial sync in lesson phase registers exactly the ten STATIC_TOOL_NAMES', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({}));
  const expected = sortedNames(STATIC_TOOL_NAMES);
  expect(sortedNames(registry.getRegisteredNames())).toEqual(expected);
  expect(sortedNames(ctx.getToolNames())).toEqual(expected);
});

test('registry: gate closed then gatePassed registers advance_module and start_exam', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({ gatePassed: false }));
  expect(ctx.getToolNames()).not.toContain('advance_module');
  expect(ctx.getToolNames()).not.toContain('start_exam');
  const before = ctx.toolchangeCount;
  registry.sync(snap({ gatePassed: true }));
  expect(ctx.getToolNames()).toContain('advance_module');
  expect(ctx.getToolNames()).toContain('start_exam');
  expect(ctx.toolchangeCount > before).toBe(true);
});

test('registry: gate passes then regresses revokes advance_module and start_exam', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({ gatePassed: true }));
  expect(ctx.getToolNames()).toContain('advance_module');
  expect(ctx.getToolNames()).toContain('start_exam');
  registry.sync(snap({ gatePassed: false }));
  expect(ctx.getToolNames()).not.toContain('advance_module');
  expect(ctx.getToolNames()).not.toContain('start_exam');
});

test('registry: get_misconception_brief registers after repeated fire and revokes when cleared', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({ repeatedMisconceptionIds: [] }));
  expect(ctx.getToolNames()).not.toContain('get_misconception_brief');
  registry.sync(snap({ repeatedMisconceptionIds: ['mc-x'] }));
  expect(ctx.getToolNames()).toContain('get_misconception_brief');
  registry.sync(snap({ repeatedMisconceptionIds: [] }));
  expect(ctx.getToolNames()).not.toContain('get_misconception_brief');
});

test('registry: drill tools follow commit-then-reveal and revoke on leaving drill', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({ phase: 'drill' }));
  expect(ctx.getToolNames()).toContain('mutate_assumption');
  expect(ctx.getToolNames()).toContain('commit_prediction');
  expect(ctx.getToolNames()).not.toContain('reveal_outcome');
  registry.sync(snap({ phase: 'drill', predictionCommitted: true }));
  expect(ctx.getToolNames()).toContain('reveal_outcome');
  registry.sync(snap({ phase: 'practice', predictionCommitted: true }));
  expect(ctx.getToolNames()).not.toContain('mutate_assumption');
  expect(ctx.getToolNames()).not.toContain('commit_prediction');
  expect(ctx.getToolNames()).not.toContain('reveal_outcome');
});

test('registry: exam deregister mode mass-revokes coaching tools then restores after exam', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  registry.sync(snap({ ...RICH_FLAGS, phase: 'exam' }));
  const examOnly = sortedNames(['get_exam_status', 'submit_exam']);
  expect(sortedNames(ctx.getToolNames())).toEqual(examOnly);
  expect(sortedNames(ctx.getTools().map((tool) => tool.name))).toEqual(examOnly);
  registry.sync(snap({ ...RICH_FLAGS, phase: 'exam', examSubmitted: true }));
  expect(ctx.getToolNames()).toContain('get_exam_debrief');
  expect(sortedNames(ctx.getToolNames())).toEqual(
    sortedNames(['get_exam_status', 'submit_exam', 'get_exam_debrief']),
  );
  registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
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
  registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  const priorCoaching = ctx
    .getToolNames()
    .filter(
      (name) =>
        name !== 'start_exam' &&
        name !== 'get_exam_status' &&
        name !== 'submit_exam' &&
        name !== 'get_exam_debrief',
    );
  registry.sync(snap({ ...RICH_FLAGS, phase: 'exam' }));
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

  registry.sync(snap({ ...RICH_FLAGS, phase: 'practice' }));
  const question = await ctx.callTool('get_current_question', {});
  expect(textOf(question)).toContain('question');
});

test('registry: identical snapshot sync is idempotent', () => {
  const ctx = new MockModelContext();
  const { engine } = createStubEngine();
  const registry = new ToolRegistry(ctx, engine);
  const snapshot = snap({ gatePassed: true, repeatedMisconceptionIds: ['mc-x'] });
  registry.sync(snapshot);
  const count = ctx.toolchangeCount;
  const names = ctx.getToolNames();
  registry.sync(snapshot);
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
  registry.sync(snap({ phase: 'exam', gatePassed: true }));
  registry.sync(snap({ phase: 'practice' }));
  await ctx.callTool('submit_answer', { questionId: 'q1', optionId: 'o1' });
  expect(log.submitAnswer).toEqual({ questionId: 'q1', optionId: 'o1' });
});
