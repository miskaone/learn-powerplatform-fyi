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
import { MAX_ATTEMPTS_PER_QUESTION, RUBRIC_DIMENSIONS } from '../engine';
import type {
  ActiveLessonPublic,
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
  FocusPreset,
  HintResultPublic,
  LearnerStatePublic,
  LessonBriefPublic,
  LessonTextResultPublic,
  MutateAssumptionResultPublic,
  NavigateResultPublic,
  RegistrySnapshot,
  RevealOutcomeResultPublic,
  RubricSubmission,
  RubricVerdictPublic,
  SetFocusResultPublic,
  SubmitAnswerVerdictPublic,
} from './engine-facade';

/** Attempts per question the demo script promises ("attempt 1 of 2 unused"). */
export { MAX_ATTEMPTS_PER_QUESTION } from '../engine';

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
  /**
   * UI-supplied focus hook (the engine package has no DOM). Returns
   * whether the preset was applied. Absent → setFocus reports `ok: false`.
   */
  applyFocus?: (preset: FocusPreset, anchor: string | null) => boolean;
  /** Extra corpus lines the host app supplies (e.g. lesson body text). */
  evidenceCorpus?: readonly string[];
  /**
   * Route-derived active lesson. Absent or returning null → context.lesson
   * is null. Never persisted; the host rebuilds this from the URL.
   */
  getActiveLesson?: () => ActiveLessonPublic | null;
  /**
   * Route-derived authored lesson material, supplied by the host app from
   * its lesson catalog (the engine package stays content-agnostic). Absent
   * or returning null → get_lesson_brief reports no brief.
   */
  getLessonBrief?: () => LessonBriefPublic | null;
}

/**
 * Binds the pure engine to the EngineFacade contract the WebMCP tools
 * delegate through. Field-by-field mapping only — never spreads engine
 * internals into a public payload.
 *
 * Implemented: the full practice loop (state, context, question, answer,
 * hint, routing, drill prescription, rubric, misconception brief, notes,
 * navigation) plus gate-aware `advanceModule`. The three state machines —
 * flip-condition drill, exam lifecycle, and mastery debrief — are live.
 */
export class MasteryEngineFacade implements EngineFacade {
  private readonly engine: MasteryEngine;
  private readonly manifest: ContentManifest;
  private readonly navigate: ((anchor: string) => boolean) | undefined;
  private readonly applyFocus:
    | ((preset: FocusPreset, anchor: string | null) => boolean)
    | undefined;
  private readonly evidenceCorpus: readonly string[];
  private readonly getActiveLesson:
    | (() => ActiveLessonPublic | null)
    | undefined;
  private readonly getLessonBriefSource:
    | (() => LessonBriefPublic | null)
    | undefined;

  constructor(
    engine: MasteryEngine,
    manifest: ContentManifest,
    options?: MasteryEngineFacadeOptions,
  ) {
    this.engine = engine;
    this.manifest = manifest;
    this.navigate = options?.navigate;
    this.applyFocus = options?.applyFocus;
    this.evidenceCorpus = options?.evidenceCorpus ?? [];
    this.getActiveLesson = options?.getActiveLesson;
    this.getLessonBriefSource = options?.getLessonBrief;
  }

  getLearnerState(): LearnerStatePublic {
    const state = this.engine.getLearnerState();
    return {
      scores: state.scores,
      misconceptionFires: state.misconceptionFires,
      phase: state.phase,
      gatePassed: state.gatePassed,
      attemptCount: state.attemptsCount,
      lessonAims: copyStringRecord(state.lessonAims),
      ruleCompressions: copyStringRecord(state.ruleCompressions),
      runCommitments: copyStringRecord(state.runCommitments),
      coachingNotes: state.coachingNotes.map((note) => ({
        text: note.text,
        kind: note.kind,
      })),
      coachCalibration:
        state.coachCalibration === null
          ? null
          : {
              confidenceHintCount: state.coachCalibration.confidenceHintCount,
              confidenceAgreements: state.coachCalibration.confidenceAgreements,
              highConfidenceMisses: state.coachCalibration.highConfidenceMisses,
              rubricProposalCount: state.coachCalibration.rubricProposalCount,
              rubricProposalsAccepted:
                state.coachCalibration.rubricProposalsAccepted,
            },
    };
  }

  getCurrentContext(): CurrentContextPublic {
    const question = this.engine.getCurrentQuestion();
    // Exam guard: the live exam question's concept list must not steer
    // remaining answers through the context payload (cross-review BLOCKER 1
    // family, 2026-08-27).
    const examActive = this.engine.isExamActive();
    const l = this.getActiveLesson?.() ?? null;
    // Objective resolution order: the current question's objective, then the
    // route-derived lesson's objective (question scope routinely leaves no
    // current question), then the manifest fallback. Keeps objectiveId and
    // lesson from ever contradicting each other in one payload.
    const objective = this.currentObjective(l?.objectiveId ?? null);
    return {
      objectiveId: objective ? objective.id : '',
      sectionId: objective ? objective.id : '',
      sectionTitle: objective ? objective.title : '',
      concepts: !examActive && question ? question.concepts : [],
      prerequisites: [],
      lesson:
        l === null
          ? null
          : {
              slug: l.slug,
              title: l.title,
              objectiveId: l.objectiveId,
              sectionAnchors: l.sectionAnchors.map((entry) => ({
                anchor: entry.anchor,
                title: entry.title,
              })),
            },
    };
  }

  getLessonBrief(): LessonBriefPublic | null {
    // Exam guard at the engine level: authored lesson prose is coaching
    // material, and every coaching surface is closed while an exam is live.
    if (this.engine.isExamActive()) {
      return null;
    }
    const brief = this.getLessonBriefSource?.() ?? null;
    if (brief === null) {
      return null;
    }
    return {
      id: brief.id,
      slug: brief.slug,
      title: brief.title,
      topicTitle: brief.topicTitle,
      objectiveId: brief.objectiveId,
      heroEpigraph: brief.heroEpigraph,
      governingRule: brief.governingRule,
      examClue: brief.examClue,
      mnemonic: brief.mnemonic ?? null,
      scenarioPrompt: brief.scenarioPrompt,
      concepts: brief.concepts.map((concept) => ({
        id: concept.id,
        label: concept.label,
        importance: concept.importance,
        summary: concept.summary,
      })),
      productionNuance: [...brief.productionNuance],
      scenarioExpectedAnswer: brief.scenarioExpectedAnswer ?? null,
      distractors: brief.distractors.map((d) => ({
        choice: d.choice,
        whyTempting: d.whyTempting,
        whyWrong: d.whyWrong,
      })),
      visual: {
        type: brief.visual.type,
        title: brief.visual.title,
        steps: brief.visual.steps.map((s) => ({
          label: s.label,
          state: s.state,
          detail: s.detail,
        })),
      },
      drills: {
        recall: brief.drills.recall,
        connections: brief.drills.connections,
        application: brief.drills.application,
        transfer: brief.drills.transfer,
      },
      reflection: [...brief.reflection],
      sections: brief.sections.map((section) => ({
        anchor: section.anchor,
        title: section.title,
      })),
      references: brief.references.map((reference) => ({
        label: reference.label,
        url: reference.url,
      })),
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
      rationale: verdict.rationale,
      remediationAnchor: verdict.remediationAnchor,
      defeatedMisconception:
        verdict.defeatedMisconception === null
          ? null
          : {
              id: verdict.defeatedMisconception.id,
              name: verdict.defeatedMisconception.name,
            },
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

  requestNextAction(
    confidence?: 'low' | 'high',
  ): NextAction | 'continue' | 'rubric_interview' {
    return this.engine.requestNextAction(confidence);
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

  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setLessonAim(aim: string, lessonKey?: string): LessonTextResultPublic {
    return this.setLessonText(
      (key, text) => this.engine.setLessonAim(key, text),
      aim,
      lessonKey,
    );
  }

  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRuleCompression(text: string, lessonKey?: string): LessonTextResultPublic {
    return this.setLessonText(
      (key, value) => this.engine.setRuleCompression(key, value),
      text,
      lessonKey,
    );
  }

  /**
   * Keyed by the route-derived active lesson slug, or 'track' when no
   * lesson is active; learner/agent-authored reflective text — persisted
   * on the ledger, exposed via getLearnerState, NEVER admitted to the
   * rubric evidence corpus; engine-guarded against exam-mode writes.
   */
  setRunCommitment(text: string, lessonKey?: string): LessonTextResultPublic {
    return this.setLessonText(
      (key, value) => this.engine.setRunCommitment(key, value),
      text,
      lessonKey,
    );
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
    const result = this.engine.scoreRubric(
      engineInput,
      this.buildEvidenceCorpus(),
    );
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

  logCoachingNote(
    note: string,
    kind?: 'observation' | 'preference' | 'context',
  ): { stored: boolean; reason: string | null } {
    // Persisted on the engine ledger (Ledger.coachNotes) via the storage
    // adapter, so notes survive reload and the Debrief graft can read them.
    // The engine validates/clamps input and caps the stored list.
    const result = this.engine.logCoachingNote(note, kind);
    return { stored: result.stored, reason: result.reason };
  }

  navigateToAnchor(anchor: string): NavigateResultPublic {
    const ok = this.navigate ? this.navigate(anchor) : false;
    return { ok, anchor };
  }

  setFocus(preset: FocusPreset, anchor?: string): SetFocusResultPublic {
    // Exam lighting is site-managed: the page applies/clears it on the
    // examActive edge. Agent (and page-parity) requests are always refused
    // so the theme can never be applied outside an exam or stripped inside one.
    if (preset === 'exam-lighting') {
      return { ok: false, preset, anchor: null, reason: 'site-managed' };
    }

    // Exam guard: agent-less surfaces execute without a registry
    // (deregistration of set_focus during exam-mode is defense in
    // depth, not the guard). Every preset except clear-focus is refused.
    if (this.engine.isExamActive() && preset !== 'clear-focus') {
      return { ok: false, preset, anchor: null, reason: 'exam-active' };
    }

    if (preset === 'focus-section') {
      if (anchor === undefined || anchor.trim() === '') {
        return { ok: false, preset, anchor: null, reason: 'anchor-required' };
      }
      const lesson = this.getActiveLesson?.() ?? null;
      const known =
        lesson !== null &&
        lesson.sectionAnchors.some((section) => section.anchor === anchor);
      if (!known) {
        return { ok: false, preset, anchor, reason: 'unknown-anchor' };
      }
      const applied = this.applyFocus
        ? this.applyFocus('focus-section', anchor)
        : false;
      return {
        ok: applied,
        preset,
        anchor,
        reason: applied ? null : 'not-applied',
      };
    }

    const applied = this.applyFocus ? this.applyFocus(preset, null) : false;
    return {
      ok: applied,
      preset,
      anchor: null,
      reason: applied ? null : 'not-applied',
    };
  }

  getMisconceptionBrief(misconceptionId: string): Misconception | null {
    // Exam guard: a misconception contrast is the answer key for any exam
    // question keyed to it (cross-review BLOCKER 1 — the contrast string
    // answered the live exam question). Nothing is briefed mid-exam.
    if (this.engine.isExamActive()) {
      return null;
    }
    const fires = this.engine.getLearnerState().misconceptionFires[misconceptionId];
    if (!(fires >= 1)) {
      return null;
    }
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
    scenarioId: string,
    assumptionId: string,
  ): MutateAssumptionResultPublic {
    const r = this.engine.mutateAssumption(scenarioId, assumptionId);
    return {
      accepted: r.accepted,
      scenarioId: r.scenarioId,
      round: r.round,
      assumptionText: r.assumptionText,
    };
  }

  commitPrediction(
    scenarioId: string,
    prediction: string,
    reason: string,
  ): CommitPredictionResultPublic {
    const r = this.engine.commitPrediction(scenarioId, prediction, reason);
    return {
      committed: r.committed,
      scenarioId: r.scenarioId,
      refusalReason: r.refusalReason,
    };
  }

  revealOutcome(scenarioId: string): RevealOutcomeResultPublic {
    const r = this.engine.revealOutcome(scenarioId);
    return {
      outcome: r.outcomeComponent,
      predictionWasCorrect: r.predictionWasCorrect,
      explanationAnchor: r.explanationAnchor,
    };
  }

  startExam(): ExamStatusPublic {
    const r = this.engine.startExam();
    return {
      active: r.active,
      remainingSeconds: r.remainingSeconds,
      questionsAnswered: r.questionsAnswered,
      questionsTotal: r.questionsTotal,
      submitted: r.submitted,
    };
  }

  getExamStatus(): ExamStatusPublic {
    const r = this.engine.getExamStatus();
    return {
      active: r.active,
      remainingSeconds: r.remainingSeconds,
      questionsAnswered: r.questionsAnswered,
      questionsTotal: r.questionsTotal,
      submitted: r.submitted,
    };
  }

  submitExam(): ExamStatusPublic {
    const r = this.engine.submitExam();
    return {
      active: r.active,
      remainingSeconds: r.remainingSeconds,
      questionsAnswered: r.questionsAnswered,
      questionsTotal: r.questionsTotal,
      submitted: r.submitted,
    };
  }

  getExamDebrief(): ExamDebriefPublic {
    const r = this.engine.getExamDebrief();
    return {
      scores: {
        recall: r.scores.recall,
        connections: r.scores.connections,
        application: r.scores.application,
        transfer: r.scores.transfer,
      },
      missedConceptIds: r.missedConceptIds.slice(),
      misconceptionIdsFired: r.misconceptionIdsFired.slice(),
    };
  }

  advanceModule(): AdvanceModuleResultPublic {
    // TODO(day-2): module-progression state lives in the engine ledger once
    // phase transitions land; today this reports gate status + next objective.
    // Exam guard: module progression is frozen while an exam is live
    // (cross-review BLOCKER 1 — advanceModule advanced during the exam).
    if (this.engine.isExamActive()) {
      return { advanced: false, nextObjectiveId: null };
    }
    const state = this.engine.getLearnerState();
    if (!state.gatePassed) {
      return { advanced: false, nextObjectiveId: null };
    }
    return { advanced: true, nextObjectiveId: this.nextObjectiveId() };
  }

  composeDebrief(segments: DebriefSegment[]): ComposeDebriefResultPublic {
    const r = this.engine.composeDebrief(segments);
    return {
      accepted: r.accepted,
      rejectedSegmentIds: r.rejectedSegmentIds.slice(),
      reason: r.reason,
    };
  }

  getNarrationScript(): NarrationCue[] {
    return this.engine.getNarrationScript().map((cue) => {
      return {
        segmentId: cue.segmentId,
        order: cue.order,
        scriptLine: cue.scriptLine,
      };
    });
  }

  advanceSegment(segmentId: string): AdvanceSegmentResultPublic {
    const r = this.engine.advanceSegment(segmentId);
    return {
      ok: r.ok,
      currentSegmentId: r.currentSegmentId,
    };
  }

  getRegistrySnapshot(): RegistrySnapshot {
    const state = this.engine.getLearnerState();
    const fires = state.misconceptionFires;
    const repeatedMisconceptionIds: string[] = [];
    for (const id of Object.keys(fires)) {
      if (fires[id] >= 2) {
        repeatedMisconceptionIds.push(id);
      }
    }
    return {
      phase: state.phase,
      gatePassed: state.gatePassed,
      repeatedMisconceptionIds,
      predictionCommitted: this.engine.getActiveDrill()?.prediction != null,
      examSubmitted: this.engine.getExamState()?.submitted === true,
      moduleComplete: this.engine.isModuleComplete(),
    };
  }

  private buildEvidenceCorpus(): string {
    // Corpus rule: nothing the tool surface itself emits may count as
    // evidence, or the agent can harvest its own "verbatim quotes" and
    // self-award the gate (cross-review BLOCKER, 2026-08-27). Excluded:
    // question prompts and option texts (get_current_question), misconception
    // names/contrasts/seeds (get_misconception_brief, tier-2 hints), and
    // objective titles (get_current_context.sectionTitle). Admitted: objective
    // summaries and the host-supplied corpus (lesson body text the learner
    // reads on the page). Also excluded: the ledger's coachNotes,
    // lessonAims, ruleCompressions, and runCommitments — learner/agent-authored,
    // so admitting them would let an agent launder fabricated evidence
    // through those write surfaces and then quote it back "verbatim".
    const lines: string[] = [];
    for (const objective of this.manifest.objectives) {
      lines.push(objective.summary);
    }
    for (const extra of this.evidenceCorpus) {
      lines.push(extra);
    }
    return lines.join('\n');
  }

  private assertCurrentQuestion(questionId: string): void {
    const current = this.engine.getCurrentQuestion();
    if (!current || current.id !== questionId) {
      throw new RangeError(
        `question-not-current: ${questionId} is not the engine's current question`,
      );
    }
  }

  private currentObjective(preferredObjectiveId?: string | null): Objective | null {
    const question = this.engine.getCurrentQuestion();
    const objectiveId = question
      ? question.objectiveId
      : (preferredObjectiveId ??
        (this.manifest.objectives.length > 0
          ? this.manifest.objectives[this.manifest.objectives.length - 1].id
          : null));
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

  private setLessonText(
    write: (
      key: string,
      text: string,
    ) => { stored: boolean; reason: string | null; value: string | null },
    text: string,
    lessonKey?: string,
  ): LessonTextResultPublic {
    // Explicit key (page surfaces pass the slug they render under) wins over
    // the ambient active-lesson slug so read and write can never diverge
    // (cross-review fix, 2026-08-28); tools keep the ambient/track contract.
    const key = lessonKey ?? this.getActiveLesson?.()?.slug ?? 'track';
    const result = write(key, text);
    return {
      stored: result.stored,
      reason: result.reason,
      lessonKey: key,
      value: result.value,
    };
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

function copyStringRecord(
  record: Record<string, string>,
): Record<string, string> {
  const copied: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    copied[key] = record[key];
  }
  return copied;
}
