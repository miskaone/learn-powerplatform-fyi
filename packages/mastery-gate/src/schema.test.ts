import { test, expect } from 'bun:test';
import type {
  Ledger,
  Question,
  QuestionOptionPublic,
  QuestionPublic,
} from './schema';
import { toQuestionPublic } from './schema';

type AssertAbsent<T, K extends PropertyKey> = K extends keyof T ? never : true;

const _noCorrectOptionId: AssertAbsent<QuestionPublic, 'correctOptionId'> = true;
const _noRationale: AssertAbsent<QuestionPublic, 'rationale'> = true;
const _noRemediationAnchor: AssertAbsent<QuestionPublic, 'remediationAnchor'> =
  true;
const _noMisconceptionId: AssertAbsent<QuestionOptionPublic, 'misconceptionId'> =
  true;

void _noCorrectOptionId;
void _noRationale;
void _noRemediationAnchor;
void _noMisconceptionId;

const sampleQuestion: Question = {
  id: 'q-plugin-isolation',
  objectiveId: 'obj-plug-ins',
  concepts: ['IOrganizationService', 'plugin isolation'],
  prompt: 'Which service should a plug-in use to write Dataverse data?',
  options: [
    {
      id: 'opt-a',
      text: 'IOrganizationService',
    },
    {
      id: 'opt-b',
      text: 'An outbound HTTP client to the Web API',
      misconceptionId: 'mc-http-from-plugin',
    },
    {
      id: 'opt-c',
      text: 'OrganizationDataService',
      misconceptionId: 'mc-legacy-orgdata',
    },
  ],
  correctOptionId: 'opt-a',
  rationale: 'Plug-ins write through IOrganizationService inside the sandbox.',
  remediationAnchor: 'lesson-plugin-services',
};

test('toQuestionPublic structurally omits answer-key and distractor-map fields', () => {
  const publicQuestion = toQuestionPublic(sampleQuestion);
  const serialized = JSON.stringify(publicQuestion);

  expect(serialized).not.toContain('correctOptionId');
  expect(serialized).not.toContain('rationale');
  expect(serialized).not.toContain('remediationAnchor');
  expect(serialized).not.toContain('misconception');

  const optionIds = publicQuestion.options.map((option) => option.id);
  expect(optionIds).toContain(sampleQuestion.correctOptionId);
  expect(optionIds.filter((id) => id === sampleQuestion.correctOptionId)).toEqual(
    [sampleQuestion.correctOptionId],
  );
  expect(serialized.split(sampleQuestion.correctOptionId).length).toBe(2);

  expect(Object.keys(publicQuestion)).toEqual([
    'id',
    'objectiveId',
    'concepts',
    'prompt',
    'options',
  ]);

  for (const option of publicQuestion.options) {
    expect(Object.keys(option)).toEqual(['id', 'text']);
  }
});

test("empty Ledger typechecks with phase 'lesson' and all four rubric dimensions at 0", () => {
  const ledger: Ledger = {
    attempts: [],
    misconceptionFires: {},
    scores: {
      recall: 0,
      connections: 0,
      application: 0,
      transfer: 0,
    },
    coachNotes: [],
    phase: 'lesson',
    drillResults: [],
    activeDrill: null,
    exam: null,
    debrief: null,
    learnerName: null,
  };

  expect(ledger.phase).toBe('lesson');
  expect(ledger.attempts).toEqual([]);
  expect(ledger.scores).toEqual({
    recall: 0,
    connections: 0,
    application: 0,
    transfer: 0,
  });
});
