import type {
  ContentManifest,
  Ledger,
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
  createEmptyLedger,
  MAX_COACH_NOTE_LENGTH,
  recordAttempt,
} from './ledger';
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
  /** Route-derived question filter. Never persisted. */
  private questionScope: Set<string> | null = null;

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

  setQuestionScope(questionIds: readonly string[] | null): void {
    this.questionScope = questionIds === null ? null : new Set(questionIds);
  }

  getQuestionScope(): string[] | null {
    if (this.questionScope === null) {
      return null;
    }
    return Array.from(this.questionScope);
  }

  getCurrentQuestion(): QuestionPublic | null {
    const question = this.findCurrentQuestion();
    if (!question) {
      return null;
    }
    return toQuestionPublic(question);
  }

  /**
   * Global ledger view of questions that have at least one attempt.
   * Ignores question scope. Contains no option ids or answer-key material.
   */
  getQuestionProgress(): {
    questionId: string;
    attempts: number;
    correct: boolean;
  }[] {
    const progress: {
      questionId: string;
      attempts: number;
      correct: boolean;
    }[] = [];
    for (const question of this.manifest.questions) {
      let attempts = 0;
      let correct = false;
      for (const attempt of this.ledger.attempts) {
        if (attempt.questionId !== question.id) {
          continue;
        }
        attempts += 1;
        if (attempt.correct) {
          correct = true;
        }
      }
      if (attempts >= 1) {
        progress.push({
          questionId: question.id,
          attempts,
          correct,
        });
      }
    }
    return progress;
  }

  submitAnswer(optionId: string): SubmitAnswerResult {
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

    this.ledger = {
      attempts: this.ledger.attempts.slice(),
      misconceptionFires: copyFires(this.ledger.misconceptionFires),
      scores: {
        recall: result.scores.recall,
        connections: result.scores.connections,
        application: result.scores.application,
        transfer: result.scores.transfer,
      },
      coachNotes: this.ledger.coachNotes.slice(),
      phase: this.ledger.phase,
    };
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
    this.ledger = {
      attempts: this.ledger.attempts.slice(),
      misconceptionFires: copyFires(this.ledger.misconceptionFires),
      scores: {
        recall: this.ledger.scores.recall,
        connections: this.ledger.scores.connections,
        application: this.ledger.scores.application,
        transfer: this.ledger.scores.transfer,
      },
      coachNotes: clampCoachNotes([...this.ledger.coachNotes, trimmed]),
      phase: this.ledger.phase,
    };
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

  private findCurrentQuestion(): Question | null {
    for (const question of this.manifest.questions) {
      if (this.questionScope !== null && !this.questionScope.has(question.id)) {
        continue;
      }
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
