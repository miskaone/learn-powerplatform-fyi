import { test, expect } from 'bun:test';
import { MasteryEngine, MemoryStorageAdapter } from '../engine';
import { FIXTURE_MANIFEST } from '../engine/fixtures';
import type { DebriefSegment, QuestionPublic } from '../schema';
import { MasteryEngineFacade } from './engine-adapter';
import type {
  ComposeDebriefResultPublic,
  EngineFacade,
  ExamStatusPublic,
  LearnerStatePublic,
  LessonTextResultPublic,
  RubricSubmission,
  SubmitAnswerVerdictPublic,
} from './engine-facade';
import type { ToolResponse } from './model-context';
import { ALL_TOOL_NAMES } from './tool-names';
import { createToolset } from './tools';

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
  nextActionConfidence: 'low' | 'high' | 'unset' | null;
  composeDebrief: DebriefSegment[] | null;
  navigateToAnchor: string | null;
  setLessonAim: string | null;
}

function createStubEngine(options?: {
  question?: QuestionPublic | null;
  firedMisconceptionIds?: string[];
  submitVerdict?: SubmitAnswerVerdictPublic;
  composeResult?: ComposeDebriefResultPublic;
  learnerState?: LearnerStatePublic;
  nextAction?: 'hint' | 'review' | 'coach' | 'go_deeper' | 'advance' | 'continue' | 'rubric_interview';
  scoreGatePassed?: boolean;
  lessonTextResult?: LessonTextResultPublic;
  startExamStatus?: ExamStatusPublic;
  submitExamStatus?: ExamStatusPublic;
}): { engine: EngineFacade; log: EngineLog } {
  const log: EngineLog = {
    submitAnswer: null,
    scoreRubric: null,
    nextActionConfidence: null,
    composeDebrief: null,
    navigateToAnchor: null,
    setLessonAim: null,
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
    options !== undefined && Object.prototype.hasOwnProperty.call(options, 'question')
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
    requestNextAction: (confidence) => {
      log.nextActionConfidence = confidence ?? 'unset';
      if (options?.nextAction !== undefined) {
        return options.nextAction;
      }
      return confidence === 'low' ? 'go_deeper' : 'hint';
    },
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
        gatePassed: options?.scoreGatePassed ?? false,
        rejectionReason: null,
      };
    },
    setLessonAim: (aim) => {
      log.setLessonAim = aim;
      return (
        options?.lessonTextResult ?? {
          stored: true,
          reason: null,
          lessonKey: 'track',
          value: aim,
        }
      );
    },
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
    startExam: () =>
      options?.startExamStatus ?? {
        active: true,
        remainingSeconds: 600,
        questionsAnswered: 0,
        questionsTotal: 4,
        submitted: false,
      },
    getExamStatus: () => ({
      active: true,
      remainingSeconds: 599,
      questionsAnswered: 0,
      questionsTotal: 4,
      submitted: false,
    }),
    submitExam: () =>
      options?.submitExamStatus ?? {
        active: false,
        remainingSeconds: 0,
        questionsAnswered: 4,
        questionsTotal: 4,
        submitted: true,
      },
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

function textOf(response: ToolResponse): string {
  return response.content[0].text;
}

function payloadOf(response: ToolResponse): unknown {
  return JSON.parse(textOf(response));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function evidenceQuote(dimension: string): string {
  return `Quoted lesson evidence for ${dimension}.`;
}

test('createToolset returns exactly 23 tools with closed object schemas', () => {
  const { engine } = createStubEngine();
  const tools = createToolset(engine);
  const names = Object.keys(tools);
  expect(names.length).toBe(23);
  for (const name of ALL_TOOL_NAMES) {
    expect(names).toContain(name);
    const tool = tools[name];
    expect(tool.name).toBe(name);
    expect(tool.description.length > 0).toBe(true);
    expect(tool.inputSchema['type']).toBe('object');
    expect(tool.inputSchema['additionalProperties']).toBe(false);
  }
});

test('get_current_question returns the public question and omits answer-key fields', async () => {
  const { engine } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.get_current_question.execute({});
  const text = textOf(response);
  expect(payloadOf(response)).toEqual({ question: SAMPLE_QUESTION });
  expect(text).not.toContain('correctOptionId');
  expect(text).not.toContain('rationale');
  expect(text).not.toContain('remediationAnchor');
  expect(text).not.toContain('misconception');
});

test('submit_answer on a miss returns the misconception id and never the correct option', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.submit_answer.execute({
    questionId: 'q-plugin-isolation',
    optionId: 'opt-b',
  });
  const text = textOf(response);
  expect(text).toContain('mc-http-from-plugin');
  expect(text).not.toContain('correctOptionId');
  expect(log.submitAnswer).toEqual({
    questionId: 'q-plugin-isolation',
    optionId: 'opt-b',
  });
});

test('submit_answer with missing optionId returns invalid_input and does not call the engine', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.submit_answer.execute({
    questionId: 'q-plugin-isolation',
  });
  expect(asRecord(payloadOf(response))['error']).toBe('invalid_input');
  expect(log.submitAnswer).toBe(null);
});

test('score_rubric with empty evidenceQuote returns evidence_required and does not call the engine', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.score_rubric.execute({
    recall: { score: 3, evidenceQuote: evidenceQuote('recall') },
    connections: { score: 3, evidenceQuote: '   ' },
    application: { score: 2, evidenceQuote: evidenceQuote('application') },
    transfer: { score: 1, evidenceQuote: evidenceQuote('transfer') },
  });
  expect(payloadOf(response)).toEqual({
    error: 'evidence_required',
    dimension: 'connections',
  });
  expect(log.scoreRubric).toBe(null);
});

test('score_rubric clamps out-of-range scores to 0..4 before delegating', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);
  await tools.score_rubric.execute({
    recall: { score: 7, evidenceQuote: evidenceQuote('recall') },
    connections: { score: -1, evidenceQuote: evidenceQuote('connections') },
    application: { score: 2, evidenceQuote: evidenceQuote('application') },
    transfer: { score: 3, evidenceQuote: evidenceQuote('transfer') },
  });
  expect(log.scoreRubric === null).toBe(false);
  if (log.scoreRubric !== null) {
    expect(log.scoreRubric.recall.score).toBe(4);
    expect(log.scoreRubric.connections.score).toBe(0);
    expect(log.scoreRubric.application.score).toBe(2);
    expect(log.scoreRubric.transfer.score).toBe(3);
  }
});

test('request_next_action passes validated confidence through to the engine', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);

  const plain = await tools.request_next_action.execute({});
  expect(payloadOf(plain)).toEqual({ verdict: 'hint' });
  expect(log.nextActionConfidence).toBe('unset');

  const low = await tools.request_next_action.execute({ confidence: 'low' });
  expect(payloadOf(low)).toEqual({ verdict: 'go_deeper' });
  expect(log.nextActionConfidence).toBe('low');

  log.nextActionConfidence = null;
  const invalid = await tools.request_next_action.execute({
    confidence: 'yolo',
  });
  expect(asRecord(payloadOf(invalid))['error']).toBe('invalid_input');
  expect(log.nextActionConfidence).toBe(null);
});

test('compose_debrief rejects a misconception segment whose id never fired', async () => {
  const { engine, log } = createStubEngine({
    firedMisconceptionIds: ['mc-http-from-plugin'],
  });
  const tools = createToolset(engine);
  const response = await tools.compose_debrief.execute({
    segments: [
      {
        id: 'seg-unfired',
        kind: 'misconception',
        scriptLine: 'HTTP from plugins is allowed.',
        misconceptionId: 'mc-never-fired',
      },
    ],
  });
  expect(payloadOf(response)).toEqual({
    error: 'segment_rejected',
    rejectedSegmentIds: ['seg-unfired'],
  });
  expect(log.composeDebrief).toBe(null);
});

test('compose_debrief with all-fired misconception ids delegates and returns the accepted result', async () => {
  const { engine, log } = createStubEngine({
    firedMisconceptionIds: ['mc-http-from-plugin'],
  });
  const tools = createToolset(engine);
  const response = await tools.compose_debrief.execute({
    segments: [
      { id: 'seg-title', kind: 'title', scriptLine: 'Mastery debrief' },
      {
        id: 'seg-mc',
        kind: 'misconception',
        scriptLine: 'Plugins cannot call outbound HTTP.',
        misconceptionId: 'mc-http-from-plugin',
      },
    ],
  });
  expect(payloadOf(response)).toEqual({
    accepted: true,
    rejectedSegmentIds: [],
    reason: null,
  });
  expect(log.composeDebrief).toEqual([
    {
      id: 'seg-title',
      kind: 'title',
      scriptLine: 'Mastery debrief',
      audioAsset: null,
    },
    {
      id: 'seg-mc',
      kind: 'misconception',
      scriptLine: 'Plugins cannot call outbound HTTP.',
      audioAsset: null,
      misconceptionId: 'mc-http-from-plugin',
    },
  ]);
});

test('get_learner_state includes all four rubric dimensions and no average', async () => {
  const { engine } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.get_learner_state.execute({});
  const payload = asRecord(payloadOf(response));
  const scores = asRecord(payload['scores']);
  expect(scores['recall']).toBe(SAMPLE_SCORES.recall);
  expect(scores['connections']).toBe(SAMPLE_SCORES.connections);
  expect(scores['application']).toBe(SAMPLE_SCORES.application);
  expect(scores['transfer']).toBe(SAMPLE_SCORES.transfer);
  expect(Object.keys(scores)).toEqual([
    'recall',
    'connections',
    'application',
    'transfer',
  ]);
  expect(textOf(response)).not.toContain('average');
});

test('navigate_to_anchor delegates the anchor string verbatim', async () => {
  const { engine, log } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.navigate_to_anchor.execute({
    anchor: 'lesson-plugin-services',
  });
  expect(log.navigateToAnchor).toBe('lesson-plugin-services');
  expect(payloadOf(response)).toEqual({
    ok: true,
    anchor: 'lesson-plugin-services',
  });
});

test('get_current_context serializes the active lesson and omits answer-key fields', async () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  const facade = new MasteryEngineFacade(engine, FIXTURE_MANIFEST, {
    getActiveLesson: () => ({
      slug: 'x',
      title: 'X',
      objectiveId: 'obj-1',
      sectionAnchors: ['x-rule'],
    }),
  });
  const tools = createToolset(facade);
  const response = await tools.get_current_context.execute({});
  const text = textOf(response);
  const payload = asRecord(payloadOf(response));
  const lesson = asRecord(payload['lesson']);
  expect(lesson['slug']).toBe('x');
  expect(lesson['title']).toBe('X');
  expect(lesson['objectiveId']).toBe('obj-1');
  expect(lesson['sectionAnchors']).toEqual(['x-rule']);
  expect(text).not.toContain('correctOptionId');
  expect(text).not.toContain('rationale');
});

test('submit_answer serializes the remediation anchor on a miss and withholds rationale until resolution', async () => {
  const { engine } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.submit_answer.execute({
    questionId: 'q-plugin-isolation',
    optionId: 'opt-b',
  });
  const payload = asRecord(payloadOf(response));
  expect(payload['remediationAnchor']).toBe('lesson-plugin-services');
  expect(payload['rationale']).toBeNull();
  expect(textOf(response)).not.toContain('correctOptionId');
});

const TEACH_BACK_SEED =
  'Teach-back: before moving on, ask the learner to explain the corrected idea in their own words — do not advance until they can.';

const GATE_PASS_HINT =
  "Gate passed: advance_module and start_exam are now available — re-check this page's tools (getTools) before your next move.";

const EXAM_START_HINT =
  'Exam started: coaching tools are revoked until submit — only get_exam_status and submit_exam stay registered. Re-check this page\'s tools.';

const EXAM_SUBMIT_HINT =
  'Exam submitted: coaching tools are restored and get_exam_debrief is now registered — re-check this page\'s tools.';

const RUBRIC_INTERVIEW_GUIDANCE =
  'MCQ coverage is sufficient but the gate has not passed — run the rubric interview now: ask 5–8 open questions across recall, connections, application, and transfer, one at a time, never answering for the learner. Then submit score_rubric with a 0–4 score per dimension and a verbatim evidence quote for each.';

function stateWithFires(fires: Record<string, number>): LearnerStatePublic {
  return {
    scores: { ...SAMPLE_SCORES },
    misconceptionFires: fires,
    phase: 'practice',
    gatePassed: false,
    attemptCount: 1,
    lessonAims: {},
    ruleCompressions: {},
    runCommitments: {},
  };
}

function rubricInput() {
  return {
    recall: { score: 3, evidenceQuote: evidenceQuote('recall') },
    connections: { score: 3, evidenceQuote: evidenceQuote('connections') },
    application: { score: 3, evidenceQuote: evidenceQuote('application') },
    transfer: { score: 3, evidenceQuote: evidenceQuote('transfer') },
  };
}

test('set_lesson_aim validates input, delegates, and echoes the facade result', async () => {
  const echoed: LessonTextResultPublic = {
    stored: true,
    reason: null,
    lessonKey: 'plugin-isolation',
    value: 'I need to debug isolation',
  };
  const { engine, log } = createStubEngine({ lessonTextResult: echoed });
  const tools = createToolset(engine);

  const missing = await tools.set_lesson_aim.execute({});
  expect(asRecord(payloadOf(missing))['error']).toBe('invalid_input');
  expect(log.setLessonAim).toBe(null);

  const stored = await tools.set_lesson_aim.execute({
    aim: 'I need to debug isolation',
  });
  expect(log.setLessonAim).toBe('I need to debug isolation');
  expect(payloadOf(stored)).toEqual({
    stored: true,
    reason: null,
    lessonKey: 'plugin-isolation',
    value: 'I need to debug isolation',
  });
});

test('request_next_action payload carries guidance only for rubric_interview', async () => {
  const interview = createStubEngine({ nextAction: 'rubric_interview' });
  const interviewTools = createToolset(interview.engine);
  const interviewResponse = await interviewTools.request_next_action.execute({});
  expect(payloadOf(interviewResponse)).toEqual({
    verdict: 'rubric_interview',
    guidance: RUBRIC_INTERVIEW_GUIDANCE,
  });

  const hint = createStubEngine({ nextAction: 'hint' });
  const hintTools = createToolset(hint.engine);
  const hintResponse = await hintTools.request_next_action.execute({});
  expect(payloadOf(hintResponse)).toEqual({ verdict: 'hint' });
  expect(asRecord(payloadOf(hintResponse))['guidance']).toBeUndefined();
});

test('get_misconception_brief appends the teach-back seed', async () => {
  const { engine } = createStubEngine();
  const tools = createToolset(engine);
  const response = await tools.get_misconception_brief.execute({
    misconceptionId: 'mc-http-from-plugin',
  });
  const payload = asRecord(payloadOf(response));
  expect(payload['socraticSeeds']).toEqual([
    'What process hosts the plugin?',
    TEACH_BACK_SEED,
  ]);
});

test('get_learner_state maps lessonAims, ruleCompressions, and runCommitments key-by-key', async () => {
  const { engine } = createStubEngine({
    learnerState: {
      scores: { ...SAMPLE_SCORES },
      misconceptionFires: {},
      phase: 'practice',
      gatePassed: false,
      attemptCount: 1,
      lessonAims: { 'plugin-isolation': 'debug plugins' },
      ruleCompressions: { 'plugin-isolation': 'sandbox the call' },
      runCommitments: { 'plugin-isolation': 'audit one plugin' },
    },
  });
  const tools = createToolset(engine);
  const payload = asRecord(
    payloadOf(await tools.get_learner_state.execute({})),
  );
  expect(payload['lessonAims']).toEqual({
    'plugin-isolation': 'debug plugins',
  });
  expect(payload['ruleCompressions']).toEqual({
    'plugin-isolation': 'sandbox the call',
  });
  expect(payload['runCommitments']).toEqual({
    'plugin-isolation': 'audit one plugin',
  });
});

test('score_rubric toolChangeHint is present only when accepted and the gate passes', async () => {
  const closed = createStubEngine({ scoreGatePassed: false });
  const closedTools = createToolset(closed.engine);
  const closedPayload = asRecord(
    payloadOf(await closedTools.score_rubric.execute(rubricInput())),
  );
  expect(closedPayload['accepted']).toBe(true);
  expect(closedPayload['gatePassed']).toBe(false);
  expect(closedPayload['toolChangeHint']).toBeUndefined();

  const opened = createStubEngine({ scoreGatePassed: true });
  const openedTools = createToolset(opened.engine);
  const openedPayload = asRecord(
    payloadOf(await openedTools.score_rubric.execute(rubricInput())),
  );
  expect(openedPayload['accepted']).toBe(true);
  expect(openedPayload['gatePassed']).toBe(true);
  expect(openedPayload['toolChangeHint']).toBe(GATE_PASS_HINT);
});

test('submit_answer toolChangeHint is present only on the second misconception fire', async () => {
  const first = createStubEngine({
    learnerState: stateWithFires({ 'mc-http-from-plugin': 1 }),
  });
  const firstPayload = asRecord(
    payloadOf(
      await createToolset(first.engine).submit_answer.execute({
        questionId: 'q-plugin-isolation',
        optionId: 'opt-b',
      }),
    ),
  );
  expect(firstPayload['misconceptionId']).toBe('mc-http-from-plugin');
  expect(firstPayload['toolChangeHint']).toBeUndefined();

  const second = createStubEngine({
    learnerState: stateWithFires({ 'mc-http-from-plugin': 2 }),
  });
  const secondPayload = asRecord(
    payloadOf(
      await createToolset(second.engine).submit_answer.execute({
        questionId: 'q-plugin-isolation',
        optionId: 'opt-b',
      }),
    ),
  );
  expect(secondPayload['toolChangeHint']).toBe(
    'This misconception has now fired twice: get_misconception_brief is now available for "mc-http-from-plugin" — re-check this page\'s tools.',
  );

  const third = createStubEngine({
    learnerState: stateWithFires({ 'mc-http-from-plugin': 3 }),
  });
  const thirdPayload = asRecord(
    payloadOf(
      await createToolset(third.engine).submit_answer.execute({
        questionId: 'q-plugin-isolation',
        optionId: 'opt-b',
      }),
    ),
  );
  expect(thirdPayload['toolChangeHint']).toBeUndefined();
});

test('start_exam toolChangeHint is present only when the exam is active and not submitted', async () => {
  const started = createStubEngine();
  const startedPayload = asRecord(
    payloadOf(await createToolset(started.engine).start_exam.execute({})),
  );
  expect(startedPayload['toolChangeHint']).toBe(EXAM_START_HINT);

  const idle = createStubEngine({
    startExamStatus: {
      active: false,
      remainingSeconds: 0,
      questionsAnswered: 0,
      questionsTotal: 4,
      submitted: false,
    },
  });
  const idlePayload = asRecord(
    payloadOf(await createToolset(idle.engine).start_exam.execute({})),
  );
  expect(idlePayload['toolChangeHint']).toBeUndefined();

  const status = createStubEngine();
  const statusPayload = asRecord(
    payloadOf(await createToolset(status.engine).get_exam_status.execute({})),
  );
  expect(statusPayload['active']).toBe(true);
  expect(statusPayload['submitted']).toBe(false);
  expect(statusPayload['toolChangeHint']).toBeUndefined();
});

test('submit_exam toolChangeHint is present only when the exam is submitted', async () => {
  const submitted = createStubEngine();
  const submittedPayload = asRecord(
    payloadOf(await createToolset(submitted.engine).submit_exam.execute({})),
  );
  expect(submittedPayload['toolChangeHint']).toBe(EXAM_SUBMIT_HINT);

  const unsubmitted = createStubEngine({
    submitExamStatus: {
      active: true,
      remainingSeconds: 10,
      questionsAnswered: 1,
      questionsTotal: 4,
      submitted: false,
    },
  });
  const unsubmittedPayload = asRecord(
    payloadOf(
      await createToolset(unsubmitted.engine).submit_exam.execute({}),
    ),
  );
  expect(unsubmittedPayload['toolChangeHint']).toBeUndefined();
});
