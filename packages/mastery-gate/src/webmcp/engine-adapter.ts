import type {
  ContentManifest,
  DebriefSegment,
  Misconception,
  NarrationCue,
  NextAction,
  Objective,
  QuestionPublic,
  RubricDimension,
} from '../schema';
import type { MasteryEngine } from '../engine';
import { RUBRIC_DIMENSIONS } from '../engine';
import type {
  AdvanceModuleResultPublic,
  AdvanceSegmentResultPublic,
  CommitPredictionResultPublic,
  ComposeDebriefResultPublic,
  CurrentContextPublic,
  DrillKind,
  DrillPrescriptionPublic,
  EngineFacade,
  ExamDebriefPublic,
  ExamStatusPublic,
  HintResultPublic,
  LearnerStatePublic,
  MutateAssumptionResultPublic,
  NavigateResultPublic,
  RevealOutcomeResultPublic,
  RubricSubmission,
  RubricVerdictPublic,
  SubmitAnswerVerdictPublic,
} from './engine-facade';

/** Attempts per question the demo script promises ("attempt 1 of 2 unused"). */
export const MAX_ATTEMPTS_PER_QUESTION = 2;

/** Thrown by facade methods whose engine backing has not landed yet. */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`not-implemented: ${feature}`);
    this.name = 'NotImplementedError';
  }
}

const DRILL_BY_DIMENSION: Record<RubricDimension, DrillKind> = {
  recall: 'spaced_review',
  connections: 'feynman',
  application: 'failure_case',
  transfer: 'what_if',
};

export interface MasteryEngineFacadeOptions {
  /**
   * UI-supplied navigation hook (the engine package has no DOM). Returns
   * whether the anchor was found and highlighted. Absent → navigate reports
   * `ok: false`.
   */
  navigate?: (anchor: string) => boolean;
}

/**
 * Binds the pure engine to the EngineFacade contract the WebMCP tools
 * delegate through. Field-by-field mapping only — never spreads engine
 * internals into a public payload.
 *
 * Implemented: the full practice loop (state, context, question, answer,
 * hint, routing, drill prescription, rubric, misconception brief, notes,
 * navigation) plus gate-aware `advanceModule` and an inactive-exam status.
 *
 * TODO(day-2): flip-condition drill session, exam lifecycle, and debrief
 * methods throw NotImplementedError until their engine state machines land;
 * the ToolRegistry never registers those tools because the engine cannot yet
 * enter the phases that would surface them.
 */
export class MasteryEngineFacade implements EngineFacade {
  private readonly engine: MasteryEngine;
  private readonly manifest: ContentManifest;
  private readonly navigate: ((anchor: string) => boolean) | undefined;
  /** TODO(day-2): persist through the engine ledger's coachNotes instead. */
  private readonly coachingNotes: string[] = [];

  constructor(
    engine: MasteryEngine,
    manifest: ContentManifest,
    options?: MasteryEngineFacadeOptions,
  ) {
    this.engine = engine;
    this.manifest = manifest;
    this.navigate = options?.navigate;
  }

  getLearnerState(): LearnerStatePublic {
    const state = this.engine.getLearnerState();
    return {
      scores: state.scores,
      misconceptionFires: state.misconceptionFires,
      phase: state.phase,
      gatePassed: state.gatePassed,
      attemptCount: state.attemptsCount,
    };
  }

  getCurrentContext(): CurrentContextPublic {
    const objective = this.currentObjective();
    const question = this.engine.getCurrentQuestion();
    return {
      objectiveId: objective ? objective.id : '',
      sectionId: objective ? objective.id : '',
      sectionTitle: objective ? objective.title : '',
      concepts: question ? question.concepts : [],
      prerequisites: [],
    };
  }

  getCurrentQuestion(): QuestionPublic | null {
    return this.engine.getCurrentQuestion();
  }

  submitAnswer(questionId: string, optionId: string): SubmitAnswerVerdictPublic {
    this.assertCurrentQuestion(questionId);
    const verdict = this.engine.submitAnswer(optionId);
    return {
      questionId: verdict.questionId,
      correct: verdict.correct,
      misconceptionId: verdict.misconceptionId,
      attemptNumber: verdict.attemptNumber,
      attemptsRemaining: Math.max(
        0,
        MAX_ATTEMPTS_PER_QUESTION - verdict.attemptNumber,
      ),
    };
  }

  getHint(questionId: string): HintResultPublic {
    this.assertCurrentQuestion(questionId);
    const result = this.engine.requestHint();
    if (result.granted) {
      return {
        granted: true,
        tier: result.tier,
        hint: result.guidance,
        refusal: null,
      };
    }
    return {
      granted: false,
      tier: null,
      hint: null,
      refusal: result.reason,
    };
  }

  requestNextAction(): NextAction | 'continue' {
    return this.engine.requestNextAction();
  }

  prescribeDrill(): DrillPrescriptionPublic {
    const scores = this.engine.getLearnerState().scores;
    let target: RubricDimension = RUBRIC_DIMENSIONS[0];
    for (const dimension of RUBRIC_DIMENSIONS) {
      if (scores[dimension] < scores[target]) {
        target = dimension;
      }
    }
    return {
      drillKind: DRILL_BY_DIMENSION[target],
      targetDimension: target,
      rationale: `${target} is the weakest dimension (score ${scores[target]}/4).`,
    };
  }

  scoreRubric(submission: RubricSubmission): RubricVerdictPublic {
    // Facade key is `evidenceQuote`; the engine validator expects `quote`.
    const engineInput: Record<string, { score: number; quote: string }> = {};
    for (const dimension of RUBRIC_DIMENSIONS) {
      const entry = submission[dimension];
      engineInput[dimension] = {
        score: entry.score,
        quote: entry.evidenceQuote,
      };
    }
    const result = this.engine.scoreRubric(engineInput);
    const state = this.engine.getLearnerState();
    if (result.ok) {
      return {
        accepted: true,
        scores: result.scores,
        gatePassed: state.gatePassed,
        rejectionReason: null,
      };
    }
    return {
      accepted: false,
      scores: state.scores,
      gatePassed: state.gatePassed,
      rejectionReason: result.errors.join('; '),
    };
  }

  logCoachingNote(note: string): void {
    this.coachingNotes.push(note);
  }

  navigateToAnchor(anchor: string): NavigateResultPublic {
    const ok = this.navigate ? this.navigate(anchor) : false;
    return { ok, anchor };
  }

  getMisconceptionBrief(misconceptionId: string): Misconception | null {
    for (const misconception of this.manifest.misconceptions) {
      if (misconception.id === misconceptionId) {
        return misconception;
      }
    }
    return null;
  }

  getFiredMisconceptionIds(): string[] {
    const fires = this.engine.getLearnerState().misconceptionFires;
    const ids: string[] = [];
    for (const id of Object.keys(fires)) {
      if (fires[id] >= 1) {
        ids.push(id);
      }
    }
    return ids;
  }

  mutateAssumption(
    _scenarioId: string,
    _assumptionId: string,
  ): MutateAssumptionResultPublic {
    throw new NotImplementedError('flip-condition-drill-session');
  }

  commitPrediction(
    _scenarioId: string,
    _prediction: string,
    _reason: string,
  ): CommitPredictionResultPublic {
    throw new NotImplementedError('flip-condition-drill-session');
  }

  revealOutcome(_scenarioId: string): RevealOutcomeResultPublic {
    throw new NotImplementedError('flip-condition-drill-session');
  }

  startExam(): ExamStatusPublic {
    throw new NotImplementedError('exam-lifecycle');
  }

  getExamStatus(): ExamStatusPublic {
    return {
      active: false,
      remainingSeconds: 0,
      questionsAnswered: 0,
      questionsTotal: 0,
      submitted: false,
    };
  }

  submitExam(): ExamStatusPublic {
    throw new NotImplementedError('exam-lifecycle');
  }

  getExamDebrief(): ExamDebriefPublic {
    throw new NotImplementedError('exam-lifecycle');
  }

  advanceModule(): AdvanceModuleResultPublic {
    // TODO(day-2): module-progression state lives in the engine ledger once
    // phase transitions land; today this reports gate status + next objective.
    const state = this.engine.getLearnerState();
    if (!state.gatePassed) {
      return { advanced: false, nextObjectiveId: null };
    }
    return { advanced: true, nextObjectiveId: this.nextObjectiveId() };
  }

  composeDebrief(_segments: DebriefSegment[]): ComposeDebriefResultPublic {
    throw new NotImplementedError('mastery-debrief');
  }

  getNarrationScript(): NarrationCue[] {
    throw new NotImplementedError('mastery-debrief');
  }

  advanceSegment(_segmentId: string): AdvanceSegmentResultPublic {
    throw new NotImplementedError('mastery-debrief');
  }

  private assertCurrentQuestion(questionId: string): void {
    const current = this.engine.getCurrentQuestion();
    if (!current || current.id !== questionId) {
      throw new RangeError(
        `question-not-current: ${questionId} is not the engine's current question`,
      );
    }
  }

  private currentObjective(): Objective | null {
    const question = this.engine.getCurrentQuestion();
    const objectiveId = question
      ? question.objectiveId
      : this.manifest.objectives.length > 0
        ? this.manifest.objectives[this.manifest.objectives.length - 1].id
        : null;
    if (objectiveId === null) {
      return null;
    }
    for (const objective of this.manifest.objectives) {
      if (objective.id === objectiveId) {
        return objective;
      }
    }
    return null;
  }

  private nextObjectiveId(): string | null {
    const current = this.currentObjective();
    if (!current) {
      return null;
    }
    const index = this.manifest.objectives.findIndex(
      (objective) => objective.id === current.id,
    );
    if (index >= 0 && index + 1 < this.manifest.objectives.length) {
      return this.manifest.objectives[index + 1].id;
    }
    return null;
  }
}
