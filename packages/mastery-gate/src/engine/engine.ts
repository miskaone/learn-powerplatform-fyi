import type {
  ContentManifest,
  DebriefSegment,
  DebriefState,
  DrillResultRecord,
  DrillSessionState,
  ExamState,
  Ledger,
  NarrationCue,
  Question,
  QuestionPublic,
  RubricScores,
  StorageAdapter,
  ToolPhase,
} from '../schema';
import { toQuestionPublic } from '../schema';
import type { GradeResult } from './grading';
import { gradeAnswer } from './grading';
import type { HintResult, HintState } from './hints';
import { createHintState, requestHint as nextHint } from './hints';
import {
  attemptCount,
  clampCoachNotes,
  cloneLedger,
  createEmptyLedger,
  MAX_COACH_NOTE_LENGTH,
  MAX_LEARNER_NAME_LENGTH,
  recordAttempt,
} from './ledger';
import type {
  CommitResult,
  MutateResult,
  RevealResult,
  StartDrillResult,
} from './drill';
import {
  applyCommitPrediction,
  applyEndDrill,
  applyMutateAssumption,
  applyRevealOutcome,
  applyStartDrill,
} from './drill';
import type { ComposeDebriefResult } from './debrief';
import {
  applyAdvanceSegment,
  applyComposeDebrief,
  buildNarrationCues,
} from './debrief';
import type { ExamDebrief, ExamStatus } from './exam';
import {
  applyCreateExam,
  applyExpireIfNeeded,
  applyExitExam,
  applyRecordExamAnswer,
  applySubmitExam,
  buildExamDebrief,
  findCurrentExamQuestion,
  isExamActive,
  toExamStatus,
} from './exam';
import { gatePasses } from './rubric';
import type { RubricValidationResult } from './rubricEvidence';
import { validateRubricSubmission } from './rubricEvidence';
import type { RoutingVerdict } from './routing';
import { routeNextAction } from './routing';
import { loadState, saveState, STORAGE_KEY } from './storage';

export interface LearnerStatePublic {
  scores: RubricScores;
  misconceptionFires: Record<string, number>;
  phase: ToolPhase;
  gatePassed: boolean;
  attemptsCount: number;
}

export interface SubmitAnswerResult {
  questionId: string;
  optionId: string;
  correct: boolean;
  misconceptionId: string | null;
  attemptNumber: number;
}

export const MAX_ATTEMPTS_PER_QUESTION = 2;

export interface MasteryEngineOptions {
  now?: () => number;
}

export class MasteryEngine {
  private readonly manifest: ContentManifest;
  private readonly adapter: StorageAdapter;
  private readonly now: () => number;
  private ledger: Ledger;
  private hints: HintState;
  /** Persisted with the ledger so routing verdicts survive a page reload. */
  private lastGrade: GradeResult | null;

  constructor(
    manifest: ContentManifest,
    adapter: StorageAdapter,
    options?: MasteryEngineOptions,
  ) {
    this.manifest = manifest;
    this.adapter = adapter;
    this.now = options?.now ?? Date.now;
    const persisted = loadState(adapter);
    if (persisted) {
      this.ledger = persisted.ledger;
      this.hints = persisted.hints;
      this.lastGrade = persisted.lastGrade;
    } else {
      this.ledger = createEmptyLedger();
      this.hints = createHintState();
      this.lastGrade = null;
    }
  }

  getCurrentQuestion(): QuestionPublic | null {
    this.maybeAutoSubmitExpiredExam();
    if (isExamActive(this.ledger.exam)) {
      const exam = this.ledger.exam;
      if (exam === null) {
        return null;
      }
      const examQuestion = findCurrentExamQuestion(this.manifest, exam);
      if (!examQuestion) {
        return null;
      }
      return toQuestionPublic(examQuestion);
    }
    const question = this.findCurrentQuestion();
    if (!question) {
      return null;
    }
    return toQuestionPublic(question);
  }

  submitAnswer(optionId: string): SubmitAnswerResult {
    this.maybeAutoSubmitExpiredExam();
    if (isExamActive(this.ledger.exam)) {
      const { ledger, result } = applyRecordExamAnswer(
        this.manifest,
        this.ledger,
        optionId,
      );
      this.ledger = ledger;
      this.persist();
      return result;
    }

    const question = this.findCurrentQuestion();
    if (!question) {
      throw new Error('no current question');
    }

    const grade = gradeAnswer(question, optionId);
    this.ledger = recordAttempt(this.ledger, grade, this.now());
    this.lastGrade = grade;
    this.persist();

    return {
      questionId: grade.questionId,
      optionId: grade.optionId,
      correct: grade.correct,
      misconceptionId: grade.misconceptionId,
      attemptNumber: attemptCount(this.ledger, question.id),
    };
  }

  requestHint(): HintResult {
    const question = this.findCurrentQuestion();
    if (!question) {
      return {
        granted: false,
        questionId: '',
        reason: 'ladder-exhausted',
      };
    }

    const { state, result } = nextHint(
      this.hints,
      this.ledger,
      question,
      this.manifest.misconceptions,
    );
    if (result.granted) {
      this.hints = state;
      this.persist();
    }
    return result;
  }

  requestNextAction(confidence?: 'low' | 'high'): RoutingVerdict {
    return routeNextAction({
      ledger: this.ledger,
      lastGrade: this.lastGrade,
      confidence,
    });
  }

  scoreRubric(input: unknown, corpus?: string): RubricValidationResult {
    // Attempt-count precondition: mastery evidence cannot exist before a
    // single graded attempt, so an agent cannot self-award the gate from a
    // cold ledger (cross-review BLOCKER, 2026-08-27).
    if (this.ledger.attempts.length === 0) {
      return {
        ok: false,
        errors: [
          'no-attempts: rubric scoring requires at least one graded attempt on the ledger',
        ],
      };
    }
    const result = validateRubricSubmission(input, corpus);
    if (!result.ok) {
      return result;
    }

    const next = cloneLedger(this.ledger);
    next.scores = {
      recall: result.scores.recall,
      connections: result.scores.connections,
      application: result.scores.application,
      transfer: result.scores.transfer,
    };
    this.ledger = next;
    this.persist();
    return result;
  }

  /**
   * Append an agent-authored coaching note to the persisted ledger. Notes are
   * validated and clamped (each ≤ MAX_COACH_NOTE_LENGTH chars, only the last
   * MAX_COACH_NOTES kept), survive reload via the storage adapter, and feed
   * the Debrief graft later. They are NEVER admitted to the rubric evidence
   * corpus — agent-authored text must not launder itself into "verbatim
   * evidence".
   */
  logCoachingNote(note: string): void {
    if (typeof note !== 'string') {
      return;
    }
    const trimmed = note.trim().slice(0, MAX_COACH_NOTE_LENGTH);
    if (trimmed.length === 0) {
      return;
    }
    const next = cloneLedger(this.ledger);
    next.coachNotes = clampCoachNotes([...next.coachNotes, trimmed]);
    this.ledger = next;
    this.persist();
  }

  getCoachNotes(): string[] {
    return this.ledger.coachNotes.slice();
  }

  getLearnerState(): LearnerStatePublic {
    return {
      scores: {
        recall: this.ledger.scores.recall,
        connections: this.ledger.scores.connections,
        application: this.ledger.scores.application,
        transfer: this.ledger.scores.transfer,
      },
      misconceptionFires: copyFires(this.ledger.misconceptionFires),
      phase: this.ledger.phase,
      gatePassed: gatePasses(this.ledger.scores),
      attemptsCount: this.ledger.attempts.length,
    };
  }

  reset(): void {
    this.adapter.removeItem(STORAGE_KEY);
    this.ledger = createEmptyLedger();
    this.hints = createHintState();
    this.lastGrade = null;
  }

  startDrill(scenarioId?: string): StartDrillResult {
    const { ledger, result } = applyStartDrill(
      this.manifest,
      this.ledger,
      scenarioId,
    );
    if (ledger !== this.ledger) {
      this.ledger = ledger;
      this.persist();
    }
    return result;
  }

  mutateAssumption(scenarioId: string, assumptionId: string): MutateResult {
    const { ledger, result } = applyMutateAssumption(
      this.manifest,
      this.ledger,
      scenarioId,
      assumptionId,
    );
    if (result.accepted) {
      this.ledger = ledger;
      this.persist();
    }
    return result;
  }

  commitPrediction(
    scenarioId: string,
    prediction: string,
    reason: string,
  ): CommitResult {
    const { ledger, result } = applyCommitPrediction(
      this.ledger,
      scenarioId,
      prediction,
      reason,
    );
    if (result.committed) {
      this.ledger = ledger;
      this.persist();
    }
    return result;
  }

  revealOutcome(scenarioId: string): RevealResult {
    const { ledger, result } = applyRevealOutcome(
      this.manifest,
      this.ledger,
      scenarioId,
      this.now(),
    );
    this.ledger = ledger;
    this.persist();
    return result;
  }

  endDrill(): void {
    const next = applyEndDrill(this.ledger);
    if (next === this.ledger) {
      return;
    }
    this.ledger = next;
    this.persist();
  }

  getDrillResults(): DrillResultRecord[] {
    return cloneLedger(this.ledger).drillResults;
  }

  getActiveDrill(): DrillSessionState | null {
    return cloneLedger(this.ledger).activeDrill;
  }

  startExam(): ExamStatus {
    const examAtEntry = this.ledger.exam;
    const wasUnsubmitted = examAtEntry !== null && !examAtEntry.submitted;
    this.maybeAutoSubmitExpiredExam();
    if (wasUnsubmitted) {
      return toExamStatus(this.ledger.exam, this.now());
    }
    if (!gatePasses(this.ledger.scores)) {
      throw new Error('refused: gate-not-passed');
    }
    if (this.ledger.activeDrill !== null) {
      throw new Error('refused: drill-active');
    }
    const { ledger, status } = applyCreateExam(
      this.manifest,
      this.ledger,
      this.now(),
    );
    this.ledger = ledger;
    this.persist();
    return status;
  }

  getExamStatus(): ExamStatus {
    this.maybeAutoSubmitExpiredExam();
    return toExamStatus(this.ledger.exam, this.now());
  }

  submitExam(): ExamStatus {
    this.maybeAutoSubmitExpiredExam();
    const exam = this.ledger.exam;
    if (exam === null) {
      throw new Error('refused: no-active-exam');
    }
    if (exam.submitted) {
      return toExamStatus(exam, this.now());
    }
    const expiryAt = exam.startedAt + exam.durationSeconds * 1000;
    const submittedAt = Math.min(this.now(), expiryAt);
    this.ledger = applySubmitExam(this.manifest, this.ledger, submittedAt);
    this.persist();
    return toExamStatus(this.ledger.exam, this.now());
  }

  getExamDebrief(): ExamDebrief {
    this.maybeAutoSubmitExpiredExam();
    const exam = this.ledger.exam;
    if (exam === null || !exam.submitted) {
      throw new Error('refused: exam-not-submitted');
    }
    return buildExamDebrief(exam, this.ledger.scores);
  }

  exitExam(): void {
    const next = applyExitExam(this.ledger);
    if (next === this.ledger) {
      return;
    }
    this.ledger = next;
    this.persist();
  }

  isModuleComplete(): boolean {
    if (!gatePasses(this.ledger.scores)) {
      return false;
    }
    for (const question of this.manifest.questions) {
      if (attemptCount(this.ledger, question.id) < 1) {
        return false;
      }
    }
    return true;
  }

  getExamState(): ExamState | null {
    return cloneLedger(this.ledger).exam;
  }

  composeDebrief(segments: DebriefSegment[]): ComposeDebriefResult {
    const result = applyComposeDebrief(
      this.ledger,
      segments,
      this.isModuleComplete(),
    );
    if (!result.accepted) {
      return result;
    }
    const next = cloneLedger(this.ledger);
    next.debrief = {
      playlist: result.playlist.map((segment) => {
        const cloned: DebriefSegment = {
          id: segment.id,
          kind: segment.kind,
          scriptLine: segment.scriptLine,
          audioAsset: segment.audioAsset,
        };
        if (segment.misconceptionId !== undefined) {
          cloned.misconceptionId = segment.misconceptionId;
        }
        return cloned;
      }),
      currentIndex: 0,
    };
    next.phase = 'debrief';
    this.ledger = next;
    this.persist();
    return result;
  }

  getNarrationScript(): NarrationCue[] {
    return buildNarrationCues(this.ledger.debrief, this.ledger.learnerName);
  }

  advanceSegment(
    segmentId: string,
  ): { ok: boolean; currentSegmentId: string | null } {
    const { ledger, result } = applyAdvanceSegment(this.ledger, segmentId);
    if (result.ok) {
      this.ledger = ledger;
      this.persist();
    }
    return result;
  }

  setLearnerName(name: string): void {
    const trimmed = name.trim().slice(0, MAX_LEARNER_NAME_LENGTH);
    const next = cloneLedger(this.ledger);
    next.learnerName = trimmed.length === 0 ? null : trimmed;
    this.ledger = next;
    this.persist();
  }

  getLearnerName(): string | null {
    return this.ledger.learnerName;
  }

  getDebriefState(): DebriefState | null {
    return cloneLedger(this.ledger).debrief;
  }

  private maybeAutoSubmitExpiredExam(): void {
    const next = applyExpireIfNeeded(this.manifest, this.ledger, this.now());
    if (next === this.ledger) {
      return;
    }
    this.ledger = next;
    this.persist();
  }

  private findCurrentQuestion(): Question | null {
    for (const question of this.manifest.questions) {
      let hasCorrect = false;
      let total = 0;
      for (const attempt of this.ledger.attempts) {
        if (attempt.questionId !== question.id) {
          continue;
        }
        total += 1;
        if (attempt.correct) {
          hasCorrect = true;
        }
      }
      if (!hasCorrect && total < MAX_ATTEMPTS_PER_QUESTION) {
        return question;
      }
    }
    return null;
  }

  private persist(): void {
    saveState(this.adapter, {
      version: 1,
      ledger: this.ledger,
      hints: this.hints,
      lastGrade: this.lastGrade,
    });
  }
}

function copyFires(fires: Record<string, number>): Record<string, number> {
  const copy: Record<string, number> = {};
  for (const key of Object.keys(fires)) {
    copy[key] = fires[key];
  }
  return copy;
}
