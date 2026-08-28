import { describe, expect, test } from 'bun:test';
import { MasteryEngine } from './engine';
import type { AttemptRecord } from '../schema';
import {
  COVERAGE_MANIFEST,
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_EXAM,
} from './fixtures';
import { createHintState } from './hints';
import {
  createEmptyLedger,
  MAX_LESSON_AIM_LENGTH,
  MAX_LESSON_TEXT_ENTRIES,
  MAX_RULE_COMPRESSION_LENGTH,
  MAX_RUN_COMMITMENT_LENGTH,
} from './ledger';
import { MemoryStorageAdapter, saveState } from './storage';

function passingSubmission(transferScore = 3) {
  return {
    recall: { score: 3, quote: 'recall evidence quote' },
    connections: { score: 3, quote: 'connections evidence quote' },
    application: { score: 3, quote: 'application evidence quote' },
    transfer: { score: transferScore, quote: 'transfer evidence quote' },
  };
}

const SETTERS = [
  {
    name: 'setLessonAim',
    max: MAX_LESSON_AIM_LENGTH,
    set: (engine: MasteryEngine, key: string, text: string) => {
      return engine.setLessonAim(key, text);
    },
    read: (engine: MasteryEngine) => engine.getLearnerState().lessonAims,
  },
  {
    name: 'setRuleCompression',
    max: MAX_RULE_COMPRESSION_LENGTH,
    set: (engine: MasteryEngine, key: string, text: string) => {
      return engine.setRuleCompression(key, text);
    },
    read: (engine: MasteryEngine) => engine.getLearnerState().ruleCompressions,
  },
  {
    name: 'setRunCommitment',
    max: MAX_RUN_COMMITMENT_LENGTH,
    set: (engine: MasteryEngine, key: string, text: string) => {
      return engine.setRunCommitment(key, text);
    },
    read: (engine: MasteryEngine) => engine.getLearnerState().runCommitments,
  },
] as const;

for (const setter of SETTERS) {
  describe(setter.name, () => {
    test('stores and returns the clamped value, trims, and clamps at max length', () => {
      const engine = new MasteryEngine(
        FIXTURE_MANIFEST,
        new MemoryStorageAdapter(),
      );
      const stored = setter.set(engine, 'plugin-isolation', '  I need this  ');
      expect(stored).toEqual({
        stored: true,
        reason: null,
        value: 'I need this',
      });
      expect(setter.read(engine)).toEqual({
        'plugin-isolation': 'I need this',
      });

      const oversize = 'x'.repeat(setter.max + 50);
      const clamped = setter.set(engine, 'plugin-isolation', oversize);
      expect(clamped.stored).toBe(true);
      expect(clamped.reason).toBe(null);
      expect(clamped.value?.length).toBe(setter.max);
      expect(setter.read(engine)['plugin-isolation']?.length).toBe(setter.max);
    });

    test('empty or whitespace is refused and leaves the ledger untouched', () => {
      const engine = new MasteryEngine(
        FIXTURE_MANIFEST,
        new MemoryStorageAdapter(),
      );
      setter.set(engine, 'lesson-a', 'kept');
      const before = { ...setter.read(engine) };

      expect(setter.set(engine, 'lesson-a', '')).toEqual({
        stored: false,
        reason: 'empty',
        value: null,
      });
      expect(setter.set(engine, 'lesson-a', '   ')).toEqual({
        stored: false,
        reason: 'empty',
        value: null,
      });
      expect(setter.read(engine)).toEqual(before);
    });

    test("whitespace lessonKey defaults to 'track'", () => {
      const engine = new MasteryEngine(
        FIXTURE_MANIFEST,
        new MemoryStorageAdapter(),
      );
      const result = setter.set(engine, '   ', 'because I need the rule');
      expect(result.stored).toBe(true);
      expect(setter.read(engine)).toEqual({
        track: 'because I need the rule',
      });
    });

    test('entry cap accepts 24 distinct keys, refuses the 25th new key, allows overwrite', () => {
      const engine = new MasteryEngine(
        FIXTURE_MANIFEST,
        new MemoryStorageAdapter(),
      );
      for (let i = 0; i < MAX_LESSON_TEXT_ENTRIES; i += 1) {
        const result = setter.set(engine, `k${String(i).padStart(2, '0')}`, `v${i}`);
        expect(result.stored).toBe(true);
      }
      expect(Object.keys(setter.read(engine)).length).toBe(MAX_LESSON_TEXT_ENTRIES);

      const refused = setter.set(engine, 'k24', 'too many');
      expect(refused).toEqual({
        stored: false,
        reason: 'too-many-entries',
        value: null,
      });
      expect(Object.prototype.hasOwnProperty.call(setter.read(engine), 'k24')).toBe(
        false,
      );

      const overwrite = setter.set(engine, 'k00', 'replaced');
      expect(overwrite).toEqual({
        stored: true,
        reason: null,
        value: 'replaced',
      });
      expect(setter.read(engine)['k00']).toBe('replaced');
      expect(Object.keys(setter.read(engine)).length).toBe(MAX_LESSON_TEXT_ENTRIES);
    });

    test('persists across reload on the same adapter', () => {
      const adapter = new MemoryStorageAdapter();
      const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
        now: () => 1000,
      });
      setter.set(engine, 'lesson-a', 'persisted line');
      const resumed = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
        now: () => 2000,
      });
      expect(setter.read(resumed)).toEqual({ 'lesson-a': 'persisted line' });
    });

    test('reset() clears the record', () => {
      const adapter = new MemoryStorageAdapter();
      const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter);
      setter.set(engine, 'lesson-a', 'will vanish');
      engine.reset();
      expect(setter.read(engine)).toEqual({});
      const fresh = new MasteryEngine(FIXTURE_MANIFEST, adapter);
      expect(setter.read(fresh)).toEqual({});
    });
  });
}

test('exam-active refuses all three setters with no mutation', () => {
  let t = 1_000_000;
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now: () => t },
  );
  engine.submitAnswer('q1-a');
  const scored = engine.scoreRubric(passingSubmission());
  expect(scored.ok).toBe(true);
  engine.startExam();

  const before = engine.getLearnerState();
  for (const setter of SETTERS) {
    const result = setter.set(engine, 'lesson-a', 'blocked during exam');
    expect(result).toEqual({
      stored: false,
      reason: 'exam-active',
      value: null,
    });
  }
  const after = engine.getLearnerState();
  expect(after.lessonAims).toEqual(before.lessonAims);
  expect(after.ruleCompressions).toEqual(before.ruleCompressions);
  expect(after.runCommitments).toEqual(before.runCommitments);
});

test('getLearnerState exposes the three records as copies', () => {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST,
    new MemoryStorageAdapter(),
  );
  engine.setLessonAim('lesson-a', 'aim');
  engine.setRuleCompression('lesson-a', 'rule');
  engine.setRunCommitment('lesson-a', 'commitment');

  const first = engine.getLearnerState();
  expect(first.lessonAims).toEqual({ 'lesson-a': 'aim' });
  expect(first.ruleCompressions).toEqual({ 'lesson-a': 'rule' });
  expect(first.runCommitments).toEqual({ 'lesson-a': 'commitment' });

  first.lessonAims['lesson-a'] = 'mutated';
  first.ruleCompressions.extra = 'nope';
  first.runCommitments['lesson-a'] = 'changed';

  const second = engine.getLearnerState();
  expect(second.lessonAims).toEqual({ 'lesson-a': 'aim' });
  expect(second.ruleCompressions).toEqual({ 'lesson-a': 'rule' });
  expect(second.runCommitments).toEqual({ 'lesson-a': 'commitment' });
});

function answer(
  engine: MasteryEngine,
  questionId: string,
  option: 'a' | 'b' = 'a',
): void {
  engine.setQuestionScope([questionId]);
  engine.submitAnswer(`${questionId}-${option}`);
}

function coverDimensions(
  engine: MasteryEngine,
  counts: {
    recall: number;
    connections: number;
    application: number;
    transfer: number;
  },
): void {
  const byDimension = {
    recall: ['cov-recall-1', 'cov-recall-2'],
    connections: ['cov-connections-1', 'cov-connections-2'],
    application: ['cov-application-1', 'cov-application-2'],
    transfer: ['cov-transfer-1', 'cov-transfer-2'],
  } as const;
  for (const dimension of [
    'recall',
    'connections',
    'application',
    'transfer',
  ] as const) {
    const ids = byDimension[dimension];
    for (let i = 0; i < counts[dimension]; i += 1) {
      const id = ids[i];
      if (id === undefined) {
        throw new Error(`coverage fixture missing ${dimension} item ${i}`);
      }
      answer(engine, id);
    }
  }
}

describe('isRubricInterviewReady', () => {
  test('below-threshold in exactly one dimension is not ready', () => {
    const engine = new MasteryEngine(
      COVERAGE_MANIFEST,
      new MemoryStorageAdapter(),
    );
    coverDimensions(engine, {
      recall: 2,
      connections: 2,
      application: 2,
      transfer: 1,
    });
    expect(engine.isRubricInterviewReady()).toBe(false);
  });

  test('every dimension at threshold is ready', () => {
    const engine = new MasteryEngine(
      COVERAGE_MANIFEST,
      new MemoryStorageAdapter(),
    );
    coverDimensions(engine, {
      recall: 2,
      connections: 2,
      application: 2,
      transfer: 2,
    });
    expect(engine.isRubricInterviewReady()).toBe(true);
    expect(engine.requestNextAction()).toBe('rubric_interview');
  });

  test('gatePassed is not ready even with coverage', () => {
    const engine = new MasteryEngine(
      COVERAGE_MANIFEST,
      new MemoryStorageAdapter(),
    );
    coverDimensions(engine, {
      recall: 2,
      connections: 2,
      application: 2,
      transfer: 2,
    });
    expect(engine.scoreRubric(passingSubmission()).ok).toBe(true);
    expect(engine.getLearnerState().gatePassed).toBe(true);
    expect(engine.isRubricInterviewReady()).toBe(false);
    expect(engine.requestNextAction()).toBe('advance');
  });

  test('exam active is not ready even when the gate is closed', () => {
    const now = 1_000_000;
    const ledger = createEmptyLedger();
    ledger.phase = 'exam';
    ledger.exam = {
      startedAt: now,
      durationSeconds: 300,
      lastSeenAt: now,
      questionIds: ['cov-recall-1'],
      answers: {},
      submitted: false,
      submittedAt: null,
      verdicts: [],
    };
    const attempted: AttemptRecord[] = COVERAGE_MANIFEST.questions.map(
      (question, index) => {
        return {
          questionId: question.id,
          optionId: `${question.id}-a`,
          correct: true,
          misconceptionId: null,
          timestamp: index + 1,
        };
      },
    );
    ledger.attempts = attempted;

    const adapter = new MemoryStorageAdapter();
    saveState(adapter, {
      version: 1,
      ledger,
      hints: createHintState(),
      lastGrade: null,
    });
    const engine = new MasteryEngine(COVERAGE_MANIFEST, adapter, {
      now: () => now,
    });
    expect(engine.isExamActive()).toBe(true);
    expect(engine.getLearnerState().gatePassed).toBe(false);
    expect(engine.isRubricInterviewReady()).toBe(false);
  });

  test('same ledger answers the same way twice', () => {
    const engine = new MasteryEngine(
      COVERAGE_MANIFEST,
      new MemoryStorageAdapter(),
    );
    coverDimensions(engine, {
      recall: 2,
      connections: 2,
      application: 2,
      transfer: 2,
    });
    const first = engine.isRubricInterviewReady();
    const second = engine.isRubricInterviewReady();
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(first).toBe(second);
  });

  test('two attempts on the same question count once', () => {
    const engine = new MasteryEngine(
      COVERAGE_MANIFEST,
      new MemoryStorageAdapter(),
    );
    answer(engine, 'cov-recall-1', 'b');
    answer(engine, 'cov-recall-1', 'a');
    coverDimensions(engine, {
      recall: 0,
      connections: 2,
      application: 2,
      transfer: 2,
    });
    expect(engine.isRubricInterviewReady()).toBe(false);
    answer(engine, 'cov-recall-2');
    expect(engine.isRubricInterviewReady()).toBe(true);
  });
});
