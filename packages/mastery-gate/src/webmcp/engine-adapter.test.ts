import { describe, expect, test } from 'bun:test';

import { MasteryEngine, MemoryStorageAdapter } from '../engine';
import { FIXTURE_MANIFEST } from '../engine/fixtures';
import type { RubricSubmission } from './engine-facade';
import {
  MasteryEngineFacade,
  MAX_ATTEMPTS_PER_QUESTION,
  NotImplementedError,
} from './engine-adapter';
import { createToolset } from './tools';

function makeFacade(navigate?: (anchor: string) => boolean) {
  const engine = new MasteryEngine(FIXTURE_MANIFEST, new MemoryStorageAdapter());
  return {
    engine,
    facade: new MasteryEngineFacade(engine, FIXTURE_MANIFEST, { navigate }),
  };
}

const VERBATIM = {
  recall: FIXTURE_MANIFEST.questions[0].prompt,
  connections: FIXTURE_MANIFEST.questions[1].prompt,
  application: FIXTURE_MANIFEST.questions[2].options[1].text,
  transfer: FIXTURE_MANIFEST.questions[3].options[0].text,
} as const;

function rubric(
  recall: number,
  connections: number,
  application: number,
  transfer: number,
  quotes: {
    recall: string;
    connections: string;
    application: string;
    transfer: string;
  } = VERBATIM,
): RubricSubmission {
  return {
    recall: {
      score: recall as 0 | 1 | 2 | 3 | 4,
      evidenceQuote: quotes.recall,
    },
    connections: {
      score: connections as 0 | 1 | 2 | 3 | 4,
      evidenceQuote: quotes.connections,
    },
    application: {
      score: application as 0 | 1 | 2 | 3 | 4,
      evidenceQuote: quotes.application,
    },
    transfer: {
      score: transfer as 0 | 1 | 2 | 3 | 4,
      evidenceQuote: quotes.transfer,
    },
  };
}

describe('MasteryEngineFacade', () => {
  test('getLearnerState maps attemptsCount to attemptCount, no averaged field', () => {
    const { facade } = makeFacade();
    const state = facade.getLearnerState();
    expect(state.attemptCount).toBe(0);
    expect(Object.keys(state).sort()).toEqual(
      [
        'attemptCount',
        'gatePassed',
        'misconceptionFires',
        'phase',
        'scores',
      ].sort(),
    );
    expect(JSON.stringify(state)).not.toContain('average');
  });

  test('submitAnswer delegates and reports attemptsRemaining; miss names the misconception only', () => {
    const { facade } = makeFacade();
    const verdict = facade.submitAnswer('q1', 'q1-b');
    expect(verdict.correct).toBe(false);
    expect(verdict.misconceptionId).toBe('mc-shared');
    expect(verdict.attemptNumber).toBe(1);
    expect(verdict.attemptsRemaining).toBe(MAX_ATTEMPTS_PER_QUESTION - 1);
    expect(JSON.stringify(verdict)).not.toContain('correctOptionId');
    expect(JSON.stringify(verdict)).not.toContain('rationale');
  });

  test('submitAnswer rejects a stale questionId', () => {
    const { facade } = makeFacade();
    expect(() => facade.submitAnswer('q2', 'q2-b')).toThrow(RangeError);
  });

  test('hint ladder maps through: tier 1 grants, tier 2 refuses pre-attempt', () => {
    const { facade } = makeFacade();
    const first = facade.getHint('q1');
    expect(first.granted).toBe(true);
    expect(first.tier).toBe(1);
    expect(first.hint).not.toBeNull();
    const second = facade.getHint('q1');
    expect(second.granted).toBe(false);
    expect(second.refusal).toBe('tier2-requires-attempt');
  });

  test('requestNextAction surfaces the routing verdict including continue', () => {
    const { facade } = makeFacade();
    expect(facade.requestNextAction()).toBe('continue');
    facade.submitAnswer('q1', 'q1-b');
    expect(facade.requestNextAction()).toBe('hint');
  });

  test('scoreRubric maps evidenceQuote to the engine quote key and enforces the gate', () => {
    const { facade } = makeFacade();
    const refused = facade.scoreRubric(rubric(3, 3, 3, 2));
    expect(refused.accepted).toBe(true);
    expect(refused.gatePassed).toBe(false);
    const passed = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(passed.gatePassed).toBe(true);
  });

  test('scoreRubric surfaces engine validation errors on empty quotes', () => {
    const { facade } = makeFacade();
    const submission = rubric(3, 3, 3, 3);
    submission.recall = { score: 3, evidenceQuote: '   ' };
    const verdict = facade.scoreRubric(submission);
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectionReason).toContain('recall');
  });

  test('scoreRubric rejects fabricated quotes that are not in the corpus', () => {
    const { facade } = makeFacade();
    const fabricated = 'xxxxxxxxxxxx';
    const verdict = facade.scoreRubric(
      rubric(4, 4, 4, 4, {
        recall: fabricated,
        connections: fabricated,
        application: fabricated,
        transfer: fabricated,
      }),
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.gatePassed).toBe(false);
    expect(verdict.rejectionReason).toContain('verbatim');
  });

  test('scoreRubric rejects quotes laundered through log_coaching_note', () => {
    const { facade } = makeFacade();
    const laundered = 'this sentence exists only in an agent-authored note';
    facade.logCoachingNote(laundered);
    const verdict = facade.scoreRubric(
      rubric(4, 4, 4, 4, {
        recall: laundered,
        connections: laundered,
        application: laundered,
        transfer: laundered,
      }),
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.gatePassed).toBe(false);
    expect(verdict.rejectionReason).toContain('verbatim');
  });

  test('scoreRubric accepts verbatim corpus quotes and opens the gate at 3/3/3/3', () => {
    const { facade } = makeFacade();
    const verdict = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(verdict.accepted).toBe(true);
    expect(verdict.gatePassed).toBe(true);
  });

  test('scoreRubric accepts verbatim quotes but keeps the gate shut at 3/3/3/2', () => {
    const { facade } = makeFacade();
    const verdict = facade.scoreRubric(rubric(3, 3, 3, 2));
    expect(verdict.accepted).toBe(true);
    expect(verdict.gatePassed).toBe(false);
  });

  test('prescribeDrill targets the weakest dimension deterministically', () => {
    const { facade } = makeFacade();
    facade.scoreRubric(rubric(4, 3, 3, 1));
    const drill = facade.prescribeDrill();
    expect(drill.targetDimension).toBe('transfer');
    expect(drill.drillKind).toBe('what_if');
  });

  test('misconception fires and briefs come from the ledger and manifest', () => {
    const { facade } = makeFacade();
    facade.submitAnswer('q1', 'q1-b');
    expect(facade.getFiredMisconceptionIds()).toEqual(['mc-shared']);
    const brief = facade.getMisconceptionBrief('mc-shared');
    expect(brief).not.toBeNull();
    expect(facade.getMisconceptionBrief('mc-nope')).toBeNull();
  });

  test('getMisconceptionBrief is null for an unfired taxonomy id', () => {
    const { facade } = makeFacade();
    facade.submitAnswer('q1', 'q1-b');
    const fired = facade.getMisconceptionBrief('mc-shared');
    expect(fired).not.toBeNull();
    expect(fired?.id).toBe('mc-shared');
    expect(facade.getMisconceptionBrief('mc-q1-legacy')).toBeNull();
  });

  test('navigateToAnchor uses the injected hook and defaults to ok:false', () => {
    const seen: string[] = [];
    const { facade } = makeFacade((anchor) => {
      seen.push(anchor);
      return true;
    });
    expect(facade.navigateToAnchor('anchor-q1-sandbox')).toEqual({
      ok: true,
      anchor: 'anchor-q1-sandbox',
    });
    expect(seen).toEqual(['anchor-q1-sandbox']);
    const bare = makeFacade().facade;
    expect(bare.navigateToAnchor('x').ok).toBe(false);
  });

  test('advanceModule refuses while the gate is shut and names the next objective when open', () => {
    const { facade } = makeFacade();
    expect(facade.advanceModule()).toEqual({
      advanced: false,
      nextObjectiveId: null,
    });
    facade.scoreRubric(rubric(3, 3, 3, 3));
    const result = facade.advanceModule();
    expect(result.advanced).toBe(true);
    expect(result.nextObjectiveId).toBe('obj-2');
  });

  test('getExamStatus reports an inactive exam before the lifecycle lands', () => {
    const { facade } = makeFacade();
    expect(facade.getExamStatus().active).toBe(false);
  });

  test('unlanded phase machinery throws NotImplementedError', () => {
    const { facade } = makeFacade();
    expect(() => facade.mutateAssumption('s', 'a')).toThrow(NotImplementedError);
    expect(() => facade.commitPrediction('s', 'p', 'r')).toThrow(
      NotImplementedError,
    );
    expect(() => facade.revealOutcome('s')).toThrow(NotImplementedError);
    expect(() => facade.startExam()).toThrow(NotImplementedError);
    expect(() => facade.submitExam()).toThrow(NotImplementedError);
    expect(() => facade.getExamDebrief()).toThrow(NotImplementedError);
    expect(() => facade.composeDebrief([])).toThrow(NotImplementedError);
    expect(() => facade.getNarrationScript()).toThrow(NotImplementedError);
    expect(() => facade.advanceSegment('seg')).toThrow(NotImplementedError);
  });

  // TODO(day-2): unskip as the engine grows the drill/exam/debrief state
  // machines and the adapter stops throwing NotImplementedError for them.
  test.skip('flip-condition drill runs commit-then-reveal through the facade', () => {});
  test.skip('exam lifecycle revokes and restores tools through the facade', () => {});
  test.skip('compose_debrief validates segments against the live ledger', () => {});

  test('createToolset runs against the real engine with no key leakage', async () => {
    const { facade } = makeFacade();
    const tools = createToolset(facade);

    const questionTool = tools['get_current_question'];
    expect(questionTool).toBeDefined();
    const questionResponse = await questionTool.execute({});
    const questionText = JSON.stringify(questionResponse);
    expect(questionText).toContain('q1');
    expect(questionText).not.toContain('correctOptionId');
    expect(questionText).not.toContain('misconceptionId');
    expect(questionText).not.toContain('rationale');

    const submitTool = tools['submit_answer'];
    const missResponse = await submitTool.execute({
      questionId: 'q1',
      optionId: 'q1-b',
    });
    const missText = JSON.stringify(missResponse);
    expect(missText).toContain('mc-shared');
    expect(missText).not.toContain('q1-a');
  });

  test('submit_answer on an exhausted question returns question-not-current', async () => {
    const { facade } = makeFacade();
    facade.submitAnswer('q1', 'q1-b');
    facade.submitAnswer('q1', 'q1-c');
    const tools = createToolset(facade);
    const response = await tools['submit_answer'].execute({
      questionId: 'q1',
      optionId: 'q1-a',
    });
    const payload = JSON.parse(response.content[0].text) as {
      error?: string;
      questionId?: string;
    };
    expect(payload.error).toBe('question-not-current');
    expect(payload.questionId).toBe('q1');
    expect(facade.getLearnerState().attemptCount).toBe(2);
  });
});
