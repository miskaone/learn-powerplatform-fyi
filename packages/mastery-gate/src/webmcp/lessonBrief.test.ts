import { expect, test } from 'bun:test';

import { MasteryEngine, MemoryStorageAdapter } from '../engine';
import {
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_EXAM,
} from '../engine/fixtures';
import { MasteryEngineFacade } from './engine-adapter';
import type { LessonBriefPublic, RubricSubmission } from './engine-facade';
import { MockModelContext } from './mock-model-context';
import type { ToolResponse } from './model-context';
import { ToolRegistry } from './registry';
import { STATIC_TOOL_NAMES } from './tool-names';
import { createToolset } from './tools';

/**
 * ISC-76 — the grounding tool. The agent gets exactly what a learner reading
 * the lesson page gets: authored prose in, withheld material structurally out,
 * and nothing at all while an exam is live.
 */

const BRIEF: LessonBriefPublic = {
  id: 'FIX-ML-01',
  slug: 'plugin-isolation',
  title: 'Plugin isolation',
  topicTitle: 'Extending the platform',
  objectiveId: 'obj-plug-ins',
  heroEpigraph: 'Sandbox first; service second.',
  governingRule: 'A plug-in writes through IOrganizationService.',
  examClue: 'Sandbox → service → write.',
  mnemonic: 'Sandbox, Service, Write.',
  scenarioPrompt:
    'A plug-in must write to Dataverse from inside the sandbox. Order the steps.',
  scenarioOrderItems: [],
  concepts: [
    {
      id: 'sandbox',
      label: 'Sandbox isolation',
      importance: 'foundational',
      summary: 'Isolation mode constrains what a plug-in may reach.',
    },
  ],
  productionNuance: ['Never open an outbound socket from a sandboxed plug-in.'],
  scenarioExpectedAnswer: null,
  distractors: [
    {
      choice: 'Custom API',
      whyTempting: 'It looks like the platform-native hook.',
      whyWrong:
        'It runs outside the sandbox boundary the lesson is about.',
    },
  ],
  visual: {
    type: 'state walkthrough',
    title: 'Watch isolation take hold',
    steps: [
      {
        label: 'Register',
        state: 'Sandboxed',
        detail: 'The plug-in loads in isolation mode.',
      },
    ],
  },
  drills: {
    recall: 'Name the isolation mode.',
    connections: 'Relate isolation to service calls.',
    application: 'Pick the isolation mode for a nightly job.',
    transfer: 'Apply it to your own plug-in.',
  },
  reflection: ['Where would this rule have saved you time?'],
  sections: [
    { anchor: 'plugin-isolation-rule', title: 'Governing rule' },
    { anchor: 'plugin-isolation-scenario', title: '01 / Scenario' },
  ],
  references: [{ label: 'Docs', url: 'https://example.invalid/docs' }],
};

const BRIEF_KEYS = [
  'concepts',
  'distractors',
  'drills',
  'examClue',
  'governingRule',
  'heroEpigraph',
  'id',
  'mnemonic',
  'objectiveId',
  'productionNuance',
  'references',
  'reflection',
  'scenarioExpectedAnswer',
  'scenarioOrderItems',
  'scenarioPrompt',
  'sections',
  'slug',
  'title',
  'topicTitle',
  'visual',
].sort();

const REVEALED_SCENARIO_ANSWER =
  'SharePoint, because the records own many documents.';

function payloadOf(response: ToolResponse): Record<string, unknown> {
  const parsed: unknown = JSON.parse(response.content[0].text);
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function rubric(score: 0 | 1 | 2 | 3 | 4): RubricSubmission {
  return {
    recall: { score, evidenceQuote: FIXTURE_MANIFEST_WITH_EXAM.objectives[0].summary },
    connections: {
      score,
      evidenceQuote: FIXTURE_MANIFEST_WITH_EXAM.objectives[1].summary,
    },
    application: {
      score,
      evidenceQuote: FIXTURE_MANIFEST_WITH_EXAM.objectives[0].summary,
    },
    transfer: {
      score,
      evidenceQuote: FIXTURE_MANIFEST_WITH_EXAM.objectives[1].summary,
    },
  };
}

function makeFacade(brief: LessonBriefPublic | null = BRIEF) {
  const engine = new MasteryEngine(FIXTURE_MANIFEST, new MemoryStorageAdapter());
  return {
    engine,
    facade: new MasteryEngineFacade(engine, FIXTURE_MANIFEST, {
      getLessonBrief: () => brief,
    }),
  };
}

test('get_lesson_brief serializes exactly the authored fields the page shows', async () => {
  const { facade } = makeFacade();
  const tools = createToolset(facade);
  const payload = payloadOf(await tools.get_lesson_brief.execute({}));
  const brief = payload['brief'] as Record<string, unknown>;

  expect(Object.keys(brief).sort()).toEqual(BRIEF_KEYS);
  expect(brief['governingRule']).toBe(BRIEF.governingRule);
  expect(brief['scenarioPrompt']).toBe(BRIEF.scenarioPrompt);
  expect(brief['sections']).toEqual([
    { anchor: 'plugin-isolation-rule', title: 'Governing rule' },
    { anchor: 'plugin-isolation-scenario', title: '01 / Scenario' },
  ]);
  expect(brief['concepts']).toEqual([
    {
      id: 'sandbox',
      label: 'Sandbox isolation',
      importance: 'foundational',
      summary: 'Isolation mode constrains what a plug-in may reach.',
    },
  ]);
  expect(brief['scenarioExpectedAnswer']).toBe(null);
  expect(brief['distractors']).toEqual(BRIEF.distractors);
  expect(brief['visual']).toEqual(BRIEF.visual);
  expect(brief['visual']).toEqual({
    type: 'state walkthrough',
    title: 'Watch isolation take hold',
    steps: [
      {
        label: 'Register',
        state: 'Sandboxed',
        detail: 'The plug-in loads in isolation mode.',
      },
    ],
  });
  expect(brief['drills']).toEqual(BRIEF.drills);
  expect(brief['reflection']).toEqual(BRIEF.reflection);
});

test('the brief is projected field by field — a widened provider payload cannot leak', () => {
  const contaminated = {
    ...BRIEF,
    expectedAnswer: 'Sandbox, then IOrganizationService, then write.',
    correctOptionId: 'q1-a',
    rationale: 'Because the sandbox blocks outbound sockets.',
  } as unknown as LessonBriefPublic;
  const { facade } = makeFacade(contaminated);
  const projected = facade.getLessonBrief();
  const serialized = JSON.stringify(projected);

  expect(projected).not.toBeNull();
  // `scenarioExpectedAnswer` is a legitimate key; the bare substring
  // `expectedAnswer` is no longer the right instrument.
  expect(serialized).not.toContain('"expectedAnswer"');
  expect(serialized).not.toContain('correctOptionId');
  expect(serialized).not.toContain('rationale');
  expect(serialized).not.toContain('Sandbox, then IOrganizationService');
});

test('the brief hands back defensive copies, not the provider’s own arrays', () => {
  const { facade } = makeFacade();
  const first = facade.getLessonBrief();
  expect(first).not.toBeNull();
  first?.concepts.push({
    id: 'injected',
    label: 'Injected',
    importance: 'none',
    summary: 'Should not survive.',
  });
  first?.sections.push({ anchor: 'injected', title: 'Injected' });
  first?.productionNuance.push('injected');
  first?.distractors.push({
    choice: 'injected',
    whyTempting: 'injected',
    whyWrong: 'injected',
  });
  first?.visual.steps.push({
    label: 'injected',
    state: 'injected',
    detail: 'injected',
  });
  first?.reflection.push('injected');

  const second = facade.getLessonBrief();
  expect(second?.concepts.length).toBe(1);
  expect(second?.sections.length).toBe(2);
  expect(second?.productionNuance.length).toBe(1);
  expect(second?.distractors.length).toBe(1);
  expect(second?.visual.steps.length).toBe(1);
  expect(second?.reflection.length).toBe(1);
});

test('no active lesson: the tool reports no brief instead of inventing one', async () => {
  const { facade } = makeFacade(null);
  const tools = createToolset(facade);
  const payload = payloadOf(await tools.get_lesson_brief.execute({}));
  expect(payload['brief']).toBe(null);
  expect(String(payload['note'])).toContain('not on a lesson page');
});

test('exam guard: the facade refuses the brief at the ENGINE while an exam is live', () => {
  let now = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => now },
  );
  const facade = new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_EXAM, {
    // The provider keeps returning authored prose — only the engine guard
    // stands between an active exam and the lesson's teaching material.
    getLessonBrief: () => BRIEF,
  });
  facade.submitAnswer('q1', 'q1-a');
  expect(facade.scoreRubric(rubric(3)).gatePassed).toBe(true);
  expect(facade.getLessonBrief()).not.toBeNull();

  facade.startExam();
  expect(engine.isExamActive()).toBe(true);
  expect(facade.getLessonBrief()).toBe(null);

  now += 1000;
  facade.submitExam();
  expect(facade.getLessonBrief()).not.toBeNull();
});

test('exam guard: the tool refuses mid-exam even if it is still reachable', async () => {
  let now = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => now },
  );
  const facade = new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_EXAM, {
    getLessonBrief: () => BRIEF,
  });
  facade.submitAnswer('q1', 'q1-a');
  facade.scoreRubric(rubric(3));
  facade.startExam();

  const tools = createToolset(facade);
  const payload = payloadOf(await tools.get_lesson_brief.execute({}));
  const serialized = JSON.stringify(payload);
  expect(payload['brief']).toBe(null);
  expect(String(payload['note'])).toContain('exam is in progress');
  expect(serialized).not.toContain(BRIEF.governingRule);
  expect(serialized).not.toContain(BRIEF.examClue);
  expect(serialized).not.toContain(BRIEF.scenarioPrompt);
});

test('scenarioExpectedAnswer passes through when the page has revealed it, and is null when it has not', async () => {
  const revealed: LessonBriefPublic = {
    ...BRIEF,
    scenarioExpectedAnswer: REVEALED_SCENARIO_ANSWER,
  };
  const defaultPayload = payloadOf(
    await createToolset(makeFacade().facade).get_lesson_brief.execute({}),
  );
  const revealedPayload = payloadOf(
    await createToolset(makeFacade(revealed).facade).get_lesson_brief.execute(
      {},
    ),
  );
  const defaultBrief = defaultPayload['brief'] as Record<string, unknown>;
  const revealedBrief = revealedPayload['brief'] as Record<string, unknown>;

  expect(defaultBrief['scenarioExpectedAnswer']).toBe(null);
  expect(revealedBrief['scenarioExpectedAnswer']).toBe(REVEALED_SCENARIO_ANSWER);
});

test('the exam guard still refuses the widened brief', async () => {
  let now = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => now },
  );
  const facade = new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_EXAM, {
    getLessonBrief: () => BRIEF,
  });
  facade.submitAnswer('q1', 'q1-a');
  facade.scoreRubric(rubric(3));
  facade.startExam();

  const tools = createToolset(facade);
  const payload = payloadOf(await tools.get_lesson_brief.execute({}));
  const serialized = JSON.stringify(payload);
  expect(payload['brief']).toBe(null);
  expect(serialized).not.toContain('Custom API');
  expect(serialized).not.toContain('It looks like the platform-native hook.');
  expect(serialized).not.toContain(
    'It runs outside the sandbox boundary the lesson is about.',
  );
  expect(serialized).not.toContain('Watch isolation take hold');
  expect(serialized).not.toContain('The plug-in loads in isolation mode.');
  expect(serialized).not.toContain('Name the isolation mode.');
  expect(serialized).not.toContain('Relate isolation to service calls.');
  expect(serialized).not.toContain(
    'Pick the isolation mode for a nightly job.',
  );
  expect(serialized).not.toContain('Apply it to your own plug-in.');
  expect(serialized).not.toContain('Where would this rule have saved you time?');
});

test('publicLessonBrief copies field by field — a spread would leak a widened source', async () => {
  const contaminated = {
    ...BRIEF,
    secretAnswerKey: 'ml11-q2-d',
  } as unknown as LessonBriefPublic;
  // The tool boundary is the SECOND independent projection. Feeding the
  // contaminated brief through a real MasteryEngineFacade would prove nothing
  // here — the adapter's own field-by-field copy (pinned by the test above)
  // strips the extra property before publicLessonBrief ever sees it. So hand
  // createToolset a facade whose getLessonBrief returns the contaminated
  // object verbatim: this test fails the moment publicLessonBrief is replaced
  // by a spread. (Verified by mutation: adding `...brief` makes it red.)
  const base = makeFacade().facade;
  const leaky = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'getLessonBrief') {
        return () => contaminated;
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const tools = createToolset(leaky);
  const payload = payloadOf(await tools.get_lesson_brief.execute({}));
  const brief = payload['brief'] as Record<string, unknown>;
  const serialized = JSON.stringify(payload);

  expect(Object.keys(brief).sort()).toEqual(BRIEF_KEYS);
  expect(serialized).not.toContain('secretAnswerKey');
  expect(serialized).not.toContain('ml11-q2-d');
});

test('registry: get_lesson_brief is static — live in lesson and practice, revoked in exam', async () => {
  const ctx = new MockModelContext();
  const { facade } = makeFacade();
  const registry = new ToolRegistry(ctx, facade);
  const snapshot = (
    phase: 'lesson' | 'practice' | 'exam',
    extra?: { examSubmitted?: boolean },
  ) => ({
    phase,
    gatePassed: true,
    repeatedMisconceptionIds: [],
    predictionCommitted: false,
    examSubmitted: extra?.examSubmitted ?? false,
    moduleComplete: false,
  });

  expect(STATIC_TOOL_NAMES).toContain('get_lesson_brief');

  await registry.sync(snapshot('lesson'));
  expect(ctx.getToolNames()).toContain('get_lesson_brief');

  await registry.sync(snapshot('practice'));
  expect(ctx.getToolNames()).toContain('get_lesson_brief');

  await registry.sync(snapshot('exam'));
  expect(ctx.getToolNames()).not.toContain('get_lesson_brief');
  expect(ctx.getToolNames().sort()).toEqual(
    ['get_exam_status', 'submit_exam'].sort(),
  );

  await registry.sync(snapshot('practice'));
  expect(ctx.getToolNames()).toContain('get_lesson_brief');
});

test('registry: refusal mode refuses get_lesson_brief mid-exam', async () => {
  const ctx = new MockModelContext();
  const { facade } = makeFacade();
  const registry = new ToolRegistry(ctx, facade, {
    revocationMode: 'refusal',
  });
  await registry.sync({
    phase: 'exam',
    gatePassed: true,
    repeatedMisconceptionIds: [],
    predictionCommitted: false,
    examSubmitted: false,
    moduleComplete: false,
  });
  const payload = payloadOf(await ctx.callTool('get_lesson_brief', {}));
  expect(payload['refused']).toBe(true);
  expect(payload['reason']).toBe('exam-in-progress');
});
