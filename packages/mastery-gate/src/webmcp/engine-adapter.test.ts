import { describe, expect, test } from 'bun:test';

import { MasteryEngine, MemoryStorageAdapter } from '../engine';
import {
  FIXTURE_MANIFEST,
  FIXTURE_MANIFEST_WITH_DRILLS,
  FIXTURE_MANIFEST_WITH_EXAM,
} from '../engine/fixtures';
import type { DebriefSegment } from '../schema';
import type { RubricSubmission } from './engine-facade';
import {
  MasteryEngineFacade,
  MAX_ATTEMPTS_PER_QUESTION,
} from './engine-adapter';
import { createToolset } from './tools';

const UI_SCENARIO = 'sample-flip-ui';
const AUTO_SCENARIO = 'fixture-flip-automation';

function makeFacade(navigate?: (anchor: string) => boolean) {
  const engine = new MasteryEngine(FIXTURE_MANIFEST, new MemoryStorageAdapter());
  return {
    engine,
    facade: new MasteryEngineFacade(engine, FIXTURE_MANIFEST, { navigate }),
  };
}

function makeDrillFacade(now: () => number = () => 1000) {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_DRILLS,
    new MemoryStorageAdapter(),
    { now },
  );
  return {
    engine,
    facade: new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_DRILLS),
  };
}

function makeExamFacade(now: () => number) {
  const engine = new MasteryEngine(
    FIXTURE_MANIFEST_WITH_EXAM,
    new MemoryStorageAdapter(),
    { now },
  );
  return {
    engine,
    facade: new MasteryEngineFacade(engine, FIXTURE_MANIFEST_WITH_EXAM),
  };
}

function debriefSegment(
  id: string,
  kind: DebriefSegment['kind'],
  scriptLine: string,
  misconceptionId?: string,
): DebriefSegment {
  const item: DebriefSegment = {
    id,
    kind,
    scriptLine,
    audioAsset: null,
  };
  if (misconceptionId !== undefined) {
    item.misconceptionId = misconceptionId;
  }
  return item;
}

function attemptAllQuestions(facade: MasteryEngineFacade): void {
  facade.submitAnswer('q1', 'q1-a');
  facade.submitAnswer('q2', 'q2-b');
  facade.submitAnswer('q3', 'q3-b');
  facade.submitAnswer('q4', 'q4-a');
}

// Evidence must come from corpus lines the tool surface never emits:
// objective summaries (and host-supplied lesson bodies) — never question
// prompts, option texts, or misconception fields (cross-review BLOCKER).
const VERBATIM = {
  recall: FIXTURE_MANIFEST.objectives[0].summary,
  connections: FIXTURE_MANIFEST.objectives[1].summary,
  application: FIXTURE_MANIFEST.objectives[0].summary,
  transfer: FIXTURE_MANIFEST.objectives[1].summary,
} as const;

/** Rubric scoring requires at least one graded attempt on the ledger. */
function primeAttempt(facade: MasteryEngineFacade): void {
  facade.submitAnswer('q1', 'q1-a');
}

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
    primeAttempt(facade);
    const refused = facade.scoreRubric(rubric(3, 3, 3, 2));
    expect(refused.accepted).toBe(true);
    expect(refused.gatePassed).toBe(false);
    const passed = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(passed.gatePassed).toBe(true);
  });

  test('scoreRubric surfaces engine validation errors on empty quotes', () => {
    const { facade } = makeFacade();
    primeAttempt(facade);
    const submission = rubric(3, 3, 3, 3);
    submission.recall = { score: 3, evidenceQuote: '   ' };
    const verdict = facade.scoreRubric(submission);
    expect(verdict.accepted).toBe(false);
    expect(verdict.rejectionReason).toContain('recall');
  });

  test('scoreRubric rejects fabricated quotes that are not in the corpus', () => {
    const { facade } = makeFacade();
    primeAttempt(facade);
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
    primeAttempt(facade);
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

  test('scoreRubric rejects quotes harvested from tool output (prompts, options, misconceptions, titles)', () => {
    // Cross-review BLOCKER (2026-08-27): get_current_question hands the agent
    // the prompt and option texts; quoting them back must never count as
    // evidence, or the gate is self-serviceable at 4/4/4/4.
    const { facade } = makeFacade();
    primeAttempt(facade);
    const harvested = [
      FIXTURE_MANIFEST.questions[0].prompt,
      FIXTURE_MANIFEST.questions[0].options[1].text,
      FIXTURE_MANIFEST.misconceptions[0].contrast,
      FIXTURE_MANIFEST.objectives[0].title,
    ];
    for (const quote of harvested) {
      const verdict = facade.scoreRubric(
        rubric(4, 4, 4, 4, {
          recall: quote,
          connections: quote,
          application: quote,
          transfer: quote,
        }),
      );
      expect(verdict.accepted).toBe(false);
      expect(verdict.gatePassed).toBe(false);
    }
  });

  test('scoreRubric rejects any submission before the first graded attempt', () => {
    const { facade } = makeFacade();
    const verdict = facade.scoreRubric(rubric(4, 4, 4, 4));
    expect(verdict.accepted).toBe(false);
    expect(verdict.gatePassed).toBe(false);
    expect(verdict.rejectionReason).toContain('no-attempts');
  });

  test('requestNextAction routes correct + low confidence to go_deeper through the facade', () => {
    const { facade } = makeFacade();
    facade.submitAnswer('q1', 'q1-a');
    expect(facade.requestNextAction('low')).toBe('go_deeper');
    expect(facade.requestNextAction('high')).toBe('continue');
    expect(facade.requestNextAction()).toBe('continue');
  });

  test('scoreRubric accepts verbatim corpus quotes and opens the gate at 3/3/3/3', () => {
    const { facade } = makeFacade();
    primeAttempt(facade);
    const verdict = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(verdict.accepted).toBe(true);
    expect(verdict.gatePassed).toBe(true);
  });

  test('scoreRubric accepts verbatim quotes but keeps the gate shut at 3/3/3/2', () => {
    const { facade } = makeFacade();
    primeAttempt(facade);
    const verdict = facade.scoreRubric(rubric(3, 3, 3, 2));
    expect(verdict.accepted).toBe(true);
    expect(verdict.gatePassed).toBe(false);
  });

  test('prescribeDrill targets the weakest dimension deterministically', () => {
    const { facade } = makeFacade();
    primeAttempt(facade);
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
    primeAttempt(facade);
    facade.scoreRubric(rubric(3, 3, 3, 3));
    const result = facade.advanceModule();
    expect(result.advanced).toBe(true);
    expect(result.nextObjectiveId).toBe('obj-2');
  });

  test('getExamStatus reports an inactive exam before startExam', () => {
    const { facade } = makeFacade();
    expect(facade.getExamStatus().active).toBe(false);
  });

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

  test('flip-condition drill round maps public shapes and refusals through the facade', () => {
    const { engine, facade } = makeDrillFacade();
    engine.startDrill(UI_SCENARIO);

    const mutated = facade.mutateAssumption(UI_SCENARIO, 'ui-root');
    expect(mutated).toEqual({
      accepted: true,
      scenarioId: UI_SCENARIO,
      round: 1,
      assumptionText: 'External users?',
    });
    expect(Object.keys(mutated).sort()).toEqual(
      ['accepted', 'assumptionText', 'round', 'scenarioId'].sort(),
    );

    const wrongScenario = facade.mutateAssumption(AUTO_SCENARIO, 'ui-root');
    expect(wrongScenario.accepted).toBe(false);
    expect(wrongScenario.assumptionText).toBe('');

    const committed = facade.commitPrediction(
      UI_SCENARIO,
      'Power Pages',
      'external users flip the tree',
    );
    expect(committed).toEqual({
      committed: true,
      scenarioId: UI_SCENARIO,
    });

    const revealed = facade.revealOutcome(UI_SCENARIO);
    expect(revealed.outcome).toBe('Power Pages');
    expect(revealed.explanationAnchor).toBe('sample-power-pages');
    expect(revealed.predictionWasCorrect).toBe(true);
    expect(Object.keys(revealed).sort()).toEqual(
      ['explanationAnchor', 'outcome', 'predictionWasCorrect'].sort(),
    );

    const beforeCommit = makeDrillFacade();
    beforeCommit.engine.startDrill(UI_SCENARIO);
    expect(() => beforeCommit.facade.revealOutcome(UI_SCENARIO)).toThrow(
      'refused: prediction-not-committed',
    );
  });

  test('exam lifecycle maps through the facade with an injected clock and no verdict leak', () => {
    let t = 1_000_000;
    const { facade } = makeExamFacade(() => t);
    primeAttempt(facade);
    const gated = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(gated.gatePassed).toBe(true);

    const attemptsBefore = facade.getLearnerState().attemptCount;
    const started = facade.startExam();
    expect(started.active).toBe(true);
    expect(started.submitted).toBe(false);
    expect(started.remainingSeconds).toBe(300);
    expect(started.questionsTotal).toBe(3);
    expect(Object.keys(started).sort()).toEqual(
      [
        'active',
        'questionsAnswered',
        'questionsTotal',
        'remainingSeconds',
        'submitted',
      ].sort(),
    );

    const miss = facade.submitAnswer('q1', 'q1-b');
    expect(miss.misconceptionId).toBe(null);
    expect(facade.getLearnerState().attemptCount).toBe(attemptsBefore);

    facade.submitAnswer('q2', 'q2-c');
    const submitted = facade.submitExam();
    expect(submitted.submitted).toBe(true);
    expect(submitted.active).toBe(false);

    const debrief = facade.getExamDebrief();
    expect(Object.keys(debrief).sort()).toEqual(
      ['missedConceptIds', 'misconceptionIdsFired', 'scores'].sort(),
    );
    expect(debrief.misconceptionIdsFired).toContain('mc-q2-post');
    expect(debrief.missedConceptIds.length).toBeGreaterThan(0);
    expect(JSON.stringify(debrief)).not.toContain('verdicts');
  });

  test('debrief through the facade rejects unfired segments then narrates in order', () => {
    const { engine, facade } = makeExamFacade(() => 1_000_000);
    attemptAllQuestions(facade);
    const gated = facade.scoreRubric(rubric(3, 3, 3, 3));
    expect(gated.gatePassed).toBe(true);

    const refused = facade.composeDebrief([
      debriefSegment('drill-1', 'drill', 'Try the flip again'),
      debriefSegment(
        'mc-never',
        'misconception',
        'This never fired',
        'mc-q2-post',
      ),
      debriefSegment('title-1', 'title', 'Hello {learnerName}.'),
      debriefSegment('rubric-1', 'rubric', 'Every dimension cleared'),
    ]);
    expect(refused.accepted).toBe(false);
    expect(refused.rejectedSegmentIds).toEqual(['mc-never']);
    expect(Object.keys(refused).sort()).toEqual(
      ['accepted', 'reason', 'rejectedSegmentIds'].sort(),
    );

    const accepted = facade.composeDebrief([
      debriefSegment('drill-1', 'drill', 'Try the flip again'),
      debriefSegment('title-1', 'title', 'Hello {learnerName}.'),
      debriefSegment('rubric-1', 'rubric', 'Every dimension cleared'),
    ]);
    expect(accepted.accepted).toBe(true);

    engine.setLearnerName('Mike');
    const cues = facade.getNarrationScript();
    expect(cues.map((cue) => cue.order)).toEqual([0, 1, 2]);
    expect(cues[0]).toEqual({
      segmentId: 'title-1',
      order: 0,
      scriptLine: 'Hello Mike.',
    });
    expect(cues[1]?.segmentId).toBe('rubric-1');
    expect(cues[2]?.segmentId).toBe('drill-1');

    expect(facade.advanceSegment('drill-1')).toEqual({
      ok: false,
      currentSegmentId: 'title-1',
    });
    expect(facade.advanceSegment('title-1')).toEqual({
      ok: false,
      currentSegmentId: 'title-1',
    });
    expect(facade.advanceSegment('rubric-1')).toEqual({
      ok: true,
      currentSegmentId: 'rubric-1',
    });
    expect(facade.advanceSegment('drill-1')).toEqual({
      ok: true,
      currentSegmentId: 'drill-1',
    });
  });

  test('getRegistrySnapshot derives phase and booleans from real engine state', () => {
    const fresh = makeFacade().facade.getRegistrySnapshot();
    expect(fresh.phase).toBe('lesson');
    expect(fresh.predictionCommitted).toBe(false);
    expect(fresh.examSubmitted).toBe(false);
    expect(fresh.moduleComplete).toBe(false);

    const { engine: drillEngine, facade: drillFacade } = makeDrillFacade();
    drillEngine.startDrill(UI_SCENARIO);
    drillFacade.mutateAssumption(UI_SCENARIO, 'ui-root');
    drillFacade.commitPrediction(UI_SCENARIO, 'Power Pages', 'external');
    const afterCommit = drillFacade.getRegistrySnapshot();
    expect(afterCommit.predictionCommitted).toBe(true);
    expect(afterCommit.phase).toBe('drill');

    let t = 1_000_000;
    const { facade: examFacade } = makeExamFacade(() => t);
    primeAttempt(examFacade);
    examFacade.scoreRubric(rubric(3, 3, 3, 3));
    examFacade.startExam();
    examFacade.submitExam();
    expect(examFacade.getRegistrySnapshot().examSubmitted).toBe(true);

    const gatedOnly = makeExamFacade(() => 1_000_000).facade;
    primeAttempt(gatedOnly);
    gatedOnly.scoreRubric(rubric(3, 3, 3, 3));
    expect(gatedOnly.getRegistrySnapshot().moduleComplete).toBe(false);

    const attemptedOnly = makeExamFacade(() => 1_000_000).facade;
    attemptAllQuestions(attemptedOnly);
    expect(attemptedOnly.getRegistrySnapshot().moduleComplete).toBe(false);

    const complete = makeExamFacade(() => 1_000_000).facade;
    attemptAllQuestions(complete);
    complete.scoreRubric(rubric(3, 3, 3, 3));
    expect(complete.getRegistrySnapshot().moduleComplete).toBe(true);
  });
});
