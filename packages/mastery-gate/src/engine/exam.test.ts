import { test, expect } from 'bun:test';
import type { ContentManifest, QuestionOption } from '../schema';
import { MasteryEngine } from './engine';
import {
  DEFAULT_EXAM_DURATION_SECONDS,
  MAX_EXAM_DURATION_SECONDS,
  MIN_EXAM_DURATION_SECONDS,
} from './exam';
import {
  FIXTURE_MANIFEST_WITH_DRILLS,
  FIXTURE_MANIFEST_WITH_EXAM,
} from './fixtures';
import { loadState, MemoryStorageAdapter } from './storage';

function corpusOf(manifest: ContentManifest): string {
  return manifest.objectives.map((objective) => objective.summary).join('\n');
}

function passingRubric(manifest: ContentManifest, transferScore = 3) {
  const quoteA = manifest.objectives[0].summary;
  const quoteB = manifest.objectives[1].summary;
  return {
    recall: { score: 3, quote: quoteA },
    connections: { score: 3, quote: quoteB },
    application: { score: 3, quote: quoteA },
    transfer: { score: transferScore, quote: quoteB },
  };
}

function passGate(
  engine: MasteryEngine,
  manifest: ContentManifest = FIXTURE_MANIFEST_WITH_EXAM,
): void {
  engine.submitAnswer('q1-a');
  const scored = engine.scoreRubric(passingRubric(manifest), corpusOf(manifest));
  expect(scored.ok).toBe(true);
  expect(engine.getLearnerState().gatePassed).toBe(true);
}

function cloneManifestWithExam(
  source: ContentManifest,
  exam: { questionIds: string[]; durationSeconds: number } | undefined,
): ContentManifest {
  const cloned: ContentManifest = {
    courseId: source.courseId,
    title: source.title,
    objectives: source.objectives.map((objective) => {
      return {
        id: objective.id,
        title: objective.title,
        summary: objective.summary,
        questionIds: objective.questionIds.slice(),
      };
    }),
    questions: source.questions.map((question) => {
      return {
        id: question.id,
        objectiveId: question.objectiveId,
        concepts: question.concepts.slice(),
        prompt: question.prompt,
        options: question.options.map((option) => {
          const clonedOption: QuestionOption = {
            id: option.id,
            text: option.text,
          };
          if (option.misconceptionId !== undefined) {
            clonedOption.misconceptionId = option.misconceptionId;
          }
          return clonedOption;
        }),
        correctOptionId: question.correctOptionId,
        rationale: question.rationale,
        remediationAnchor: question.remediationAnchor,
      };
    }),
    misconceptions: source.misconceptions.map((misconception) => {
      return {
        id: misconception.id,
        name: misconception.name,
        contrast: misconception.contrast,
        socraticSeeds: misconception.socraticSeeds.slice(),
        anchor: misconception.anchor,
      };
    }),
  };
  if (source.flipScenarios !== undefined) {
    cloned.flipScenarios = source.flipScenarios;
  }
  if (exam !== undefined) {
    cloned.exam = {
      questionIds: exam.questionIds.slice(),
      durationSeconds: exam.durationSeconds,
    };
  }
  return cloned;
}

test('startExam before gate passes throws; while a drill is active throws', () => {
  const ungated = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => 1_000_000 },
  );
  expect(() => ungated.startExam()).toThrow('refused: gate-not-passed');

  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => 1_000_000,
  });
  passGate(engine);
  engine.startDrill('sample-flip-ui');
  expect(() => engine.startExam()).toThrow('refused: drill-active');
});

test('startExam after gate is active with config subset and phase exam', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  const status = engine.startExam();
  expect(status.active).toBe(true);
  expect(status.remainingSeconds).toBe(300);
  expect(status.questionsTotal).toBe(3);
  expect(status.questionsAnswered).toBe(0);
  expect(status.submitted).toBe(false);
  expect(engine.getLearnerState().phase).toBe('exam');
  expect(engine.getCurrentQuestion()?.id).toBe('q1');
  expect(engine.getExamState()?.questionIds).toEqual(['q1', 'q2', 'q3']);

  const local = cloneManifestWithExam(FIXTURE_MANIFEST_WITH_EXAM, {
    questionIds: ['q2', 'q2', 'nope', 'q1'],
    durationSeconds: 300,
  });
  const filtered = new MasteryEngine(local, new MemoryStorageAdapter(), {
    now: () => t,
  });
  passGate(filtered, local);
  const filteredStatus = filtered.startExam();
  expect(filteredStatus.questionsTotal).toBe(2);
  expect(filtered.getCurrentQuestion()?.id).toBe('q2');
  filtered.submitAnswer('q2-b');
  expect(filtered.getCurrentQuestion()?.id).toBe('q1');
  expect(filtered.getExamState()?.questionIds).toEqual(['q2', 'q1']);
});

test('manifest without exam config falls back to all questions and default duration; duration clamps', () => {
  let t = 1_000_000;
  const fallback = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_DRILLS,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(fallback, FIXTURE_MANIFEST_WITH_DRILLS);
  const status = fallback.startExam();
  expect(status.questionsTotal).toBe(4);
  expect(status.remainingSeconds).toBe(DEFAULT_EXAM_DURATION_SECONDS);
  expect(fallback.getExamState()?.questionIds).toEqual(['q1', 'q2', 'q3', 'q4']);
  expect(fallback.getExamState()?.durationSeconds).toBe(
    DEFAULT_EXAM_DURATION_SECONDS,
  );

  const low = cloneManifestWithExam(FIXTURE_MANIFEST_WITH_EXAM, {
    questionIds: ['q1'],
    durationSeconds: 10,
  });
  const lowEngine = new MasteryEngine(low, new MemoryStorageAdapter(), {
    now: () => t,
  });
  passGate(lowEngine, low);
  expect(lowEngine.startExam().remainingSeconds).toBe(MIN_EXAM_DURATION_SECONDS);

  const high = cloneManifestWithExam(FIXTURE_MANIFEST_WITH_EXAM, {
    questionIds: ['q1'],
    durationSeconds: 999999,
  });
  const highEngine = new MasteryEngine(high, new MemoryStorageAdapter(), {
    now: () => t,
  });
  passGate(highEngine, high);
  expect(highEngine.startExam().remainingSeconds).toBe(
    MAX_EXAM_DURATION_SECONDS,
  );
});

test('injectable clock advances remainingSeconds without real waiting', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  engine.startExam();
  t += 120_000;
  expect(engine.getExamStatus().remainingSeconds).toBe(180);
  expect(engine.getExamStatus().active).toBe(true);
  expect(engine.getExamStatus().submitted).toBe(false);
});

test('submitAnswer during active exam grades without leaking misconceptions or touching practice', () => {
  let t = 1_000_000;
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => t,
  });
  passGate(engine);
  const before = loadState(adapter);
  expect(before === null).toBe(false);
  if (before === null) {
    return;
  }
  const routingBefore = engine.requestNextAction();

  engine.startExam();
  const miss = engine.submitAnswer('q1-b');
  expect(miss.questionId).toBe('q1');
  expect(miss.optionId).toBe('q1-b');
  expect(miss.correct).toBe(false);
  expect(miss.misconceptionId).toBe(null);
  expect(miss.attemptNumber).toBe(1);
  expect(engine.getExamStatus().questionsAnswered).toBe(1);

  const after = loadState(adapter);
  expect(after === null).toBe(false);
  if (after === null) {
    return;
  }
  expect(after.ledger.attempts).toEqual(before.ledger.attempts);
  expect(after.ledger.misconceptionFires).toEqual(
    before.ledger.misconceptionFires,
  );
  expect(after.hints).toEqual(before.hints);
  expect(after.lastGrade).toEqual(before.lastGrade);
  expect(engine.requestNextAction()).toBe(routingBefore);

  engine.submitAnswer('q2-b');
  expect(engine.getExamStatus().questionsAnswered).toBe(2);
  engine.submitAnswer('q3-b');
  expect(engine.getCurrentQuestion()?.id).toBe('q3');
  const overwritten = engine.submitAnswer('q3-c');
  expect(overwritten.questionId).toBe('q3');
  expect(overwritten.correct).toBe(false);
  expect(overwritten.misconceptionId).toBe(null);
  expect(engine.getExamStatus().questionsAnswered).toBe(3);
  expect(engine.getExamState()?.answers['q3']).toBe('q3-c');
});

test('getCurrentQuestion during exam is first unanswered, then last, then practice after submit', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  engine.startExam();

  const first = engine.getCurrentQuestion();
  expect(first === null).toBe(false);
  if (first === null) {
    return;
  }
  expect(first.id).toBe('q1');
  expect(Object.keys(first)).toEqual([
    'id',
    'objectiveId',
    'concepts',
    'prompt',
    'options',
  ]);
  expect(JSON.stringify(first)).not.toContain('correctOptionId');

  engine.submitAnswer('q1-a');
  expect(engine.getCurrentQuestion()?.id).toBe('q2');
  engine.submitAnswer('q2-b');
  expect(engine.getCurrentQuestion()?.id).toBe('q3');
  engine.submitAnswer('q3-b');
  expect(engine.getCurrentQuestion()?.id).toBe('q3');

  engine.submitExam();
  expect(engine.getCurrentQuestion()?.id).toBe('q2');
});

test('submitAnswer with an option not on the current exam question throws unknown-option', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  engine.startExam();
  expect(() => engine.submitAnswer('q2-b')).toThrow('refused: unknown-option');
  expect(() => engine.submitAnswer('nope')).toThrow('refused: unknown-option');
  expect(engine.getExamStatus().questionsAnswered).toBe(0);
});

test('submitExam is idempotent and grades unanswered plus misconception distractors deterministically', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  engine.startExam();
  engine.submitAnswer('q1-a');
  engine.submitAnswer('q2-c');
  t = 1_050_000;
  const first = engine.submitExam();
  expect(first.submitted).toBe(true);
  expect(first.active).toBe(false);
  expect(first.remainingSeconds).toBe(0);
  expect(engine.getLearnerState().phase).toBe('exam');

  const exam = engine.getExamState();
  expect(exam === null).toBe(false);
  if (exam === null) {
    return;
  }
  expect(exam.submittedAt).toBe(1_050_000);
  expect(exam.verdicts).toEqual([
    {
      questionId: 'q1',
      chosenOptionId: 'q1-a',
      correct: true,
      misconceptionId: null,
      concepts: ['execution pipeline', 'sandbox boundary'],
    },
    {
      questionId: 'q2',
      chosenOptionId: 'q2-c',
      correct: false,
      misconceptionId: 'mc-q2-post',
      concepts: ['plugin stages', 'PreOperation'],
    },
    {
      questionId: 'q3',
      chosenOptionId: null,
      correct: false,
      misconceptionId: null,
      concepts: ['OpenAPI', 'custom connector'],
    },
  ]);

  const second = engine.submitExam();
  expect(second).toEqual(first);
  expect(engine.getExamState()?.submittedAt).toBe(1_050_000);
});

test('getExamDebrief refuses before submit and returns verdicts, missed concepts, and scores after', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  expect(() => engine.getExamDebrief()).toThrow('refused: exam-not-submitted');
  passGate(engine);
  engine.startExam();
  expect(() => engine.getExamDebrief()).toThrow('refused: exam-not-submitted');
  engine.submitAnswer('q1-a');
  engine.submitAnswer('q2-c');
  engine.submitExam();

  const debrief = engine.getExamDebrief();
  expect(debrief.verdicts.map((verdict) => verdict.questionId)).toEqual([
    'q1',
    'q2',
    'q3',
  ]);
  expect(debrief.verdicts[1].misconceptionId).toBe('mc-q2-post');
  expect(debrief.missedConceptIds).toEqual([
    'plugin stages',
    'PreOperation',
    'OpenAPI',
    'custom connector',
  ]);
  expect(debrief.misconceptionIdsFired).toEqual(['mc-q2-post']);
  expect(debrief.scores).toEqual({
    recall: 3,
    connections: 3,
    application: 3,
    transfer: 3,
  });
});

test('timer expiry auto-submits on the next interaction with deterministic submittedAt', () => {
  let t = 1_000_000;
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => t,
  });
  passGate(engine);
  engine.startExam();
  engine.submitAnswer('q1-a');
  const startedAt = engine.getExamState()?.startedAt;
  expect(startedAt).toBe(1_000_000);

  t = 1_000_000 + 300_000 + 1;
  const status = engine.getExamStatus();
  expect(status.submitted).toBe(true);
  expect(status.active).toBe(false);
  expect(status.remainingSeconds).toBe(0);
  const exam = engine.getExamState();
  expect(exam === null).toBe(false);
  if (exam === null) {
    return;
  }
  expect(exam.submittedAt).toBe(1_000_000 + 300 * 1000);
  expect(exam.verdicts[0]?.correct).toBe(true);
  expect(exam.verdicts[1]?.chosenOptionId).toBe(null);
  expect(exam.verdicts[2]?.chosenOptionId).toBe(null);

  let t2 = 1_000_000;
  const practice = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t2 },
  );
  passGate(practice);
  const attemptsBefore = practice.getLearnerState().attemptsCount;
  practice.startExam();
  practice.submitAnswer('q1-a');
  t2 = 1_000_000 + 300_000 + 1;
  const practiceHit = practice.submitAnswer('q2-c');
  expect(practice.getExamStatus().submitted).toBe(true);
  expect(practice.getExamState()?.answers['q2']).toBe(undefined);
  expect(practice.getExamState()?.verdicts[1]?.chosenOptionId).toBe(null);
  expect(practiceHit.questionId).toBe('q2');
  expect(practiceHit.misconceptionId).toBe('mc-q2-post');
  expect(practice.getLearnerState().attemptsCount).toBe(attemptsBefore + 1);
  expect(practice.getLearnerState().misconceptionFires['mc-q2-post']).toBe(1);
});

test('exam answers, submit, and debrief survive engine reload over the same adapter', () => {
  let t = 1_000_000;
  const adapter = new MemoryStorageAdapter();
  const first = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => t,
  });
  passGate(first);
  first.startExam();
  first.submitAnswer('q1-a');
  const status = first.getExamStatus();

  const second = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => t,
  });
  expect(second.getExamStatus()).toEqual(status);
  expect(second.getExamState()?.answers['q1']).toBe('q1-a');
  expect(second.getCurrentQuestion()?.id).toBe('q2');

  t = 1_010_000;
  const submitted = second.submitExam();
  expect(submitted.submitted).toBe(true);

  const third = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
    now: () => t,
  });
  expect(third.getExamDebrief()).toEqual(second.getExamDebrief());
  expect(third.getExamState()?.submittedAt).toBe(1_010_000);
});

test('exitExam is a no-op before submit and restores practice after; retake replaces the record', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  passGate(engine);
  engine.startExam();
  engine.submitAnswer('q1-a');
  engine.exitExam();
  expect(engine.getLearnerState().phase).toBe('exam');
  expect(engine.getExamStatus().active).toBe(true);
  expect(engine.getExamState()?.answers['q1']).toBe('q1-a');

  t = 1_020_000;
  engine.submitExam();
  expect(engine.getLearnerState().phase).toBe('exam');
  engine.exitExam();
  expect(engine.getLearnerState().phase).toBe('practice');
  expect(engine.getExamState()?.submitted).toBe(true);
  expect(engine.getExamState()?.answers['q1']).toBe('q1-a');

  t = 2_000_000;
  const retake = engine.startExam();
  expect(retake.active).toBe(true);
  expect(retake.submitted).toBe(false);
  expect(retake.questionsAnswered).toBe(0);
  expect(engine.getExamState()?.startedAt).toBe(2_000_000);
  expect(engine.getExamState()?.answers).toEqual({});
  expect(engine.getExamState()?.verdicts).toEqual([]);
  expect(engine.getLearnerState().phase).toBe('exam');
});

test('two engines with identical sequences and clocks produce deeply equal exam debriefs', () => {
  function run() {
    let t = 1_000_000;
    const adapter = new MemoryStorageAdapter();
    const engine = new MasteryEngine(FIXTURE_MANIFEST_WITH_EXAM, adapter, {
      now: () => t,
    });
    passGate(engine);
    engine.startExam();
    engine.submitAnswer('q1-a');
    engine.submitAnswer('q2-c');
    t = 1_040_000;
    engine.submitExam();
    return engine.getExamDebrief();
  }

  expect(run()).toEqual(run());
});
