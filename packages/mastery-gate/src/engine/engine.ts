import type {
  CoachNote,
  CoachNoteKind,
  ContentManifest,
  DebriefSegment,
  DebriefState,
  DrillResultRecord,
  DrillSessionState,
  ExamState,
  Ledger,
  Misconception,
  NarrationCue,
  Question,
  QuestionPublic,
  RubricDimension,
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
  clampAgentReportRecords,
  clampCoachNotes,
  cloneLedger,
  createEmptyLedger,
  MAX_COACH_NOTE_LENGTH,
  MAX_LEARNER_NAME_LENGTH,
  MAX_LESSON_AIM_LENGTH,
  MAX_LESSON_TEXT_ENTRIES,
  MAX_RULE_COMPRESSION_LENGTH,
  MAX_RUN_COMMITMENT_LENGTH,
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
  applyObserveExamClock,
  applyRecordExamAnswer,
  applySubmitExam,
  buildExamDebrief,
  findCurrentExamQuestion,
  isExamActive,
  toExamStatus,
} from './exam';
import { gatePasses, RUBRIC_DIMENSIONS } from './rubric';
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
  lessonAims: Record<string, string>;
  ruleCompressions: Record<string, string>;
  runCommitments: Record<string, string>;
  coachingNotes: CoachNote[];
  coachCalibration: CoachCalibrationSummary | null;
}

export interface CoachingNoteResult {
  stored: boolean;
  reason: 'exam-active' | 'empty' | 'answer-content' | null;
}

/** Deterministic calibration summary computed from the report-card records (ISC-73). */
export interface CoachCalibrationSummary {
  confidenceHintCount: number;
  /** high hints whose lastCorrect was true plus low hints whose lastCorrect was false. */
  confidenceAgreements: number;
  /** high-confidence hints recorded against a missed answer ("coach said high-confidence on questions missed"). */
  highConfidenceMisses: number;
  rubricProposalCount: number;
  rubricProposalsAccepted: number;
}

/** Verbatim option-text window length for the coaching-note answer-cache guard. */
export const ANSWER_TEXT_WINDOW = 20;
/**
 * Options whose normalized text is shorter than the sliding window are checked
 * as whole (token-bounded) phrases when at least this long. Anything shorter —
 * single common words like "Blocked" or "Filter" — is deliberately unguarded:
 * rejecting every note that mentions such a word would gut the memory feature,
 * and a bare word with no question binding is the same free-prose residual the
 * ISA already documents (the guard stops verbatim key stashing, not paraphrase).
 */
export const ANSWER_TEXT_MIN_PHRASE = 12;

const QUESTION_ID_IN_NOTE = /\bml\d+-q\d+(?:-[a-z0-9]+)?\b/i;
/** Id shapes surviving punctuation-stripping normalization ("ml13.q1", "ml13 q1 c"). */
const QUESTION_ID_IN_NORMALIZED_NOTE = /\bml\d+ ?q\d+\b/;

export interface LessonTextResult {
  stored: boolean;
  reason: 'exam-active' | 'empty' | 'too-many-entries' | null;
  value: string | null;
}

export const RUBRIC_INTERVIEW_MIN_COVERAGE = 2;

type LessonTextField = 'lessonAims' | 'ruleCompressions' | 'runCommitments';

export interface SubmitAnswerResult {
  questionId: string;
  optionId: string;
  /**
   * Practice: the graded verdict. Exam: always null — correctness is
   * withheld until submit so submit_answer cannot serve as a per-question
   * answer oracle mid-exam (cross-review BLOCKER 2, 2026-08-27).
   */
  correct: boolean | null;
  misconceptionId: string | null;
  attemptNumber: number;
  /**
   * The question's authored rationale — released only once the question is
   * resolved (answered correctly or attempts exhausted), so it can never leak
   * the answer while attempts remain.
   */
  rationale: string | null;
  /**
   * Same-lesson remediation anchor for this question — present only on a
   * miss. Carries no answer-key material (it names a lesson section).
   */
  remediationAnchor: string | null;
  /**
   * Present only on a correct practice verdict: the distractor-myth this
   * correct answer defeats — the learner's own previously fired misconception
   * on this question when one exists, else the question's first distractor
   * misconception. Name resolved from the manifest. Field-by-field public
   * projection; misconception names are already public post-fire material.
   */
  defeatedMisconception: { id: string; name: string } | null;
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
    const persisted = loadState(adapter, this.now());
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
    const wasExamActive = isExamActive(this.ledger.exam);
    this.maybeAutoSubmitExpiredExam();
    if (isExamActive(this.ledger.exam)) {
      const { ledger, result } = applyRecordExamAnswer(
        this.manifest,
        this.ledger,
        optionId,
      );
      this.ledger = ledger;
      this.persist();
      // Mid-exam, correctness, rationale, and remediation all stay withheld
      // — nothing that could steer remaining exam answers leaves the engine
      // before submit.
      return {
        ...result,
        rationale: null,
        remediationAnchor: null,
        defeatedMisconception: null,
      };
    }
    if (wasExamActive) {
      // The exam expired between the click and this call. The answer must
      // NOT silently fall through to practice grading — that would burn a
      // practice attempt on a different question and release its rationale
      // (cross-review MAJOR 11, 2026-08-27).
      throw new Error('refused: exam-expired');
    }

    const question = this.findCurrentQuestion();
    if (!question) {
      throw new Error('no current question');
    }

    const grade = gradeAnswer(question, optionId);
    this.ledger = recordAttempt(this.ledger, grade, this.now());
    this.lastGrade = grade;
    this.persist();

    const attemptNumber = attemptCount(this.ledger, question.id);
    const resolved =
      grade.correct || attemptNumber >= MAX_ATTEMPTS_PER_QUESTION;
    return {
      questionId: grade.questionId,
      optionId: grade.optionId,
      correct: grade.correct,
      misconceptionId: grade.misconceptionId,
      attemptNumber,
      rationale: resolved ? question.rationale : null,
      remediationAnchor: grade.correct ? null : question.remediationAnchor,
      defeatedMisconception: grade.correct
        ? resolveDefeatedMisconception(
            this.ledger,
            question,
            this.manifest.misconceptions,
          )
        : null,
    };
  }

  /**
   * True while an exam is running. Refreshes expiry first, so an expired
   * exam never reads as active. The coaching guard below and the facade's
   * exam guards both key off this.
   */
  isExamActive(): boolean {
    this.maybeAutoSubmitExpiredExam();
    return isExamActive(this.ledger.exam);
  }

  requestHint(): HintResult {
    // Exam guard: the hint ladder is a coaching surface and must not run
    // during an exam — deregistration alone was the only guard, so any
    // registry desync was a total bypass (cross-review BLOCKER 1).
    if (this.isExamActive()) {
      return {
        granted: false,
        questionId: '',
        reason: 'exam-active',
      };
    }
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
    if (confidence !== undefined && !this.isExamActive()) {
      const next = cloneLedger(this.ledger);
      next.confidenceHints = clampAgentReportRecords([
        ...next.confidenceHints,
        {
          confidence,
          lastCorrect: this.lastGrade === null ? null : this.lastGrade.correct,
          timestamp: this.now(),
        },
      ]);
      this.ledger = next;
      this.persist();
    }
    return routeNextAction({
      ledger: this.ledger,
      lastGrade: this.lastGrade,
      confidence,
      rubricInterviewReady: this.isRubricInterviewReady(),
    });
  }

  /**
   * Deterministic thresholds behind the `rubric_interview` routing verdict
   * (docs/actor-plan.md §5, ISC-66) — the referee hands the mic to the
   * agent only when MCQ coverage is sufficient to judge but the gate has
   * not passed.
   */
  isRubricInterviewReady(): boolean {
    if (gatePasses(this.ledger.scores)) {
      return false;
    }
    if (this.isExamActive()) {
      return false;
    }

    const attemptedIds = new Set<string>();
    for (const attempt of this.ledger.attempts) {
      attemptedIds.add(attempt.questionId);
    }

    const counts: Record<RubricDimension, number> = {
      recall: 0,
      connections: 0,
      application: 0,
      transfer: 0,
    };
    for (const question of this.manifest.questions) {
      if (attemptedIds.has(question.id)) {
        counts[question.dimension] += 1;
      }
    }
    for (const dimension of RUBRIC_DIMENSIONS) {
      if (counts[dimension] < RUBRIC_INTERVIEW_MIN_COVERAGE) {
        return false;
      }
    }
    return true;
  }

  setLessonAim(lessonKey: string, text: string): LessonTextResult {
    return this.setLessonText(
      'lessonAims',
      MAX_LESSON_AIM_LENGTH,
      lessonKey,
      text,
    );
  }

  setRuleCompression(lessonKey: string, text: string): LessonTextResult {
    return this.setLessonText(
      'ruleCompressions',
      MAX_RULE_COMPRESSION_LENGTH,
      lessonKey,
      text,
    );
  }

  setRunCommitment(lessonKey: string, text: string): LessonTextResult {
    return this.setLessonText(
      'runCommitments',
      MAX_RUN_COMMITMENT_LENGTH,
      lessonKey,
      text,
    );
  }

  private setLessonText(
    field: LessonTextField,
    maxLength: number,
    lessonKey: string,
    text: string,
  ): LessonTextResult {
    if (this.isExamActive()) {
      return { stored: false, reason: 'exam-active', value: null };
    }
    const clamped = text.trim().slice(0, maxLength);
    if (clamped.length === 0) {
      return { stored: false, reason: 'empty', value: null };
    }
    const key = lessonKey.trim() === '' ? 'track' : lessonKey.trim();
    const record = this.ledger[field];
    const alreadyPresent = Object.prototype.hasOwnProperty.call(record, key);
    if (!alreadyPresent && Object.keys(record).length >= MAX_LESSON_TEXT_ENTRIES) {
      return { stored: false, reason: 'too-many-entries', value: null };
    }
    const next = cloneLedger(this.ledger);
    next[field][key] = clamped;
    this.ledger = next;
    this.persist();
    return { stored: true, reason: null, value: clamped };
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
    // Exam guard: the gate must not open (or scores mutate) during a live
    // exam (cross-review BLOCKER 1 — scoreRubric opened the gate mid-exam).
    if (this.isExamActive()) {
      return {
        ok: false,
        errors: ['exam-active: rubric scoring is locked during an exam'],
      };
    }
    const result = validateRubricSubmission(input, corpus);
    const timestamp = this.now();
    if (!result.ok) {
      const next = cloneLedger(this.ledger);
      next.rubricProposals = clampAgentReportRecords([
        ...next.rubricProposals,
        {
          accepted: false,
          gatePassed: gatePasses(this.ledger.scores),
          timestamp,
        },
      ]);
      this.ledger = next;
      this.persist();
      return result;
    }

    const next = cloneLedger(this.ledger);
    next.scores = {
      recall: result.scores.recall,
      connections: result.scores.connections,
      application: result.scores.application,
      transfer: result.scores.transfer,
    };
    next.rubricProposals = clampAgentReportRecords([
      ...next.rubricProposals,
      {
        accepted: true,
        gatePassed: gatePasses(next.scores),
        timestamp,
      },
    ]);
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
  logCoachingNote(note: string, kind?: CoachNoteKind): CoachingNoteResult {
    if (typeof note !== 'string') {
      return { stored: false, reason: 'empty' };
    }
    // Exam guard: no coaching-surface mutation during a live exam
    // (cross-review BLOCKER 1).
    if (this.isExamActive()) {
      return { stored: false, reason: 'exam-active' };
    }
    const clamped = note.trim().slice(0, MAX_COACH_NOTE_LENGTH);
    if (clamped.length === 0) {
      return { stored: false, reason: 'empty' };
    }
    if (containsAnswerContent(clamped, this.manifest)) {
      return { stored: false, reason: 'answer-content' };
    }
    const next = cloneLedger(this.ledger);
    next.coachNotes = clampCoachNotes([
      ...next.coachNotes,
      { text: clamped, kind: kind ?? 'observation' },
    ]);
    this.ledger = next;
    this.persist();
    return { stored: true, reason: null };
  }

  getCoachNotes(): CoachNote[] {
    return this.ledger.coachNotes.map((entry) => ({
      text: entry.text,
      kind: entry.kind,
    }));
  }

  getCalibrationSummary(): CoachCalibrationSummary | null {
    const hints = this.ledger.confidenceHints;
    const proposals = this.ledger.rubricProposals;
    if (hints.length === 0 && proposals.length === 0) {
      return null;
    }
    let confidenceAgreements = 0;
    let highConfidenceMisses = 0;
    for (const hint of hints) {
      if (
        (hint.confidence === 'high' && hint.lastCorrect === true) ||
        (hint.confidence === 'low' && hint.lastCorrect === false)
      ) {
        confidenceAgreements += 1;
      }
      if (hint.confidence === 'high' && hint.lastCorrect === false) {
        highConfidenceMisses += 1;
      }
    }
    let rubricProposalsAccepted = 0;
    for (const proposal of proposals) {
      if (proposal.accepted) {
        rubricProposalsAccepted += 1;
      }
    }
    return {
      confidenceHintCount: hints.length,
      confidenceAgreements,
      highConfidenceMisses,
      rubricProposalCount: proposals.length,
      rubricProposalsAccepted,
    };
  }

  /**
   * Learner-facing evidence map: which questions fired each misconception
   * (glass-box panel, ISC-67). Derived from attempts; no option ids, no
   * answer-key material.
   */
  getMisconceptionEvidence(): {
    misconceptionId: string;
    fireCount: number;
    questionIds: string[];
  }[] {
    const order: string[] = [];
    const byId = new Map<
      string,
      { fireCount: number; questionIds: string[]; seen: Set<string> }
    >();
    for (const attempt of this.ledger.attempts) {
      if (attempt.correct || attempt.misconceptionId === null) {
        continue;
      }
      const id = attempt.misconceptionId;
      let entry = byId.get(id);
      if (entry === undefined) {
        entry = { fireCount: 0, questionIds: [], seen: new Set() };
        byId.set(id, entry);
        order.push(id);
      }
      entry.fireCount += 1;
      if (!entry.seen.has(attempt.questionId)) {
        entry.seen.add(attempt.questionId);
        entry.questionIds.push(attempt.questionId);
      }
    }
    const evidence: {
      misconceptionId: string;
      fireCount: number;
      questionIds: string[];
    }[] = [];
    for (const id of order) {
      const entry = byId.get(id);
      if (entry === undefined) {
        continue;
      }
      evidence.push({
        misconceptionId: id,
        fireCount: entry.fireCount,
        questionIds: entry.questionIds.slice(),
      });
    }
    return evidence;
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
      lessonAims: copyStringMap(this.ledger.lessonAims),
      ruleCompressions: copyStringMap(this.ledger.ruleCompressions),
      runCommitments: copyStringMap(this.ledger.runCommitments),
      coachingNotes: this.getCoachNotes(),
      coachCalibration: this.getCalibrationSummary(),
    };
  }

  reset(): void {
    this.adapter.removeItem(STORAGE_KEY);
    this.ledger = createEmptyLedger();
    this.hints = createHintState();
    this.lastGrade = null;
  }

  /**
   * Lesson-scoped retake: remove the named questions' attempts and hint
   * tiers from the ledger, recompute misconception fires from the attempts
   * that remain, and leave every other question — and the track-wide rubric
   * scores — untouched. "Reset" on a lesson page must not destroy the track.
   */
  resetQuestions(questionIds: readonly string[]): void {
    // Exam guard: the ledger must not be mutated mid-exam
    // (cross-review BLOCKER 1 — resetQuestions mutated the ledger mid-exam).
    if (this.isExamActive()) {
      return;
    }
    const scoped = new Set(questionIds);
    const next = cloneLedger(this.ledger);
    next.attempts = next.attempts.filter(
      (attempt) => !scoped.has(attempt.questionId),
    );
    const misconceptionFires: Record<string, number> = {};
    for (const attempt of next.attempts) {
      if (!attempt.correct && attempt.misconceptionId !== null) {
        misconceptionFires[attempt.misconceptionId] =
          (misconceptionFires[attempt.misconceptionId] ?? 0) + 1;
      }
    }
    next.misconceptionFires = misconceptionFires;
    this.ledger = next;
    const tiersIssued: Record<string, number> = {};
    for (const key of Object.keys(this.hints.tiersIssued)) {
      if (!scoped.has(key)) {
        tiersIssued[key] = this.hints.tiersIssued[key];
      }
    }
    this.hints = { tiersIssued };
    if (this.lastGrade !== null && scoped.has(this.lastGrade.questionId)) {
      this.lastGrade = null;
    }
    this.persist();
  }

  startDrill(scenarioId?: string): StartDrillResult {
    // An expired-but-unobserved exam must auto-submit before the drill
    // refusal check, or a stale exam record would wrongly block drills.
    this.maybeAutoSubmitExpiredExam();
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
    // Expiry must be observable from ANY read path — the registry snapshot
    // reads this, and a years-expired exam must not report un-submitted
    // until some other method happens to run (cross-review MINOR 15).
    this.maybeAutoSubmitExpiredExam();
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
    const now = this.now();
    // Record the clock high-water mark FIRST: expiry is then computed
    // against max(now, lastSeenAt), so a clock rollback cannot un-expire
    // a running exam (cross-review MAJOR 6).
    let next = applyObserveExamClock(this.ledger, now);
    next = applyExpireIfNeeded(this.manifest, next, now);
    if (next === this.ledger) {
      return;
    }
    this.ledger = next;
    this.persist();
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

function copyStringMap(record: Record<string, string>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    copy[key] = record[key];
  }
  return copy;
}

/**
 * Case-, whitespace-, AND punctuation-insensitive canonical form: lowercase,
 * every non-alphanumeric run collapses to a single space (cross-review fix,
 * 2026-08-28 — punctuation between words no longer breaks a verbatim match).
 */
function normalizeAnswerText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Squashed canonical form: alphanumerics only, no separators at all. Catches
 * punctuation inserted MID-word ("Regis-ter Permi-ssion…"), which the spaced
 * form cannot — stripping to spaces splits the token instead of healing it.
 */
function squashAnswerText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slidingWindowMatch(
  haystack: string,
  needle: string,
  window: number,
): boolean {
  for (let i = 0; i <= needle.length - window; i += 1) {
    if (haystack.includes(needle.slice(i, i + window))) {
      return true;
    }
  }
  return false;
}

function containsAnswerContent(
  note: string,
  manifest: ContentManifest,
): boolean {
  if (QUESTION_ID_IN_NOTE.test(note)) {
    return true;
  }
  const normalizedNote = normalizeAnswerText(note);
  if (QUESTION_ID_IN_NORMALIZED_NOTE.test(normalizedNote)) {
    return true;
  }
  const paddedNote = ` ${normalizedNote} `;
  const squashedNote = squashAnswerText(note);
  for (const question of manifest.questions) {
    for (const option of question.options) {
      const normalizedOption = normalizeAnswerText(option.text);
      const squashedOption = squashAnswerText(option.text);
      // Long options: verbatim sliding windows over BOTH canonical forms —
      // spaced (word-separated verbatim runs) and squashed (mid-word
      // punctuation insertion).
      if (
        normalizedOption.length >= ANSWER_TEXT_WINDOW &&
        slidingWindowMatch(normalizedNote, normalizedOption, ANSWER_TEXT_WINDOW)
      ) {
        return true;
      }
      if (
        squashedOption.length >= ANSWER_TEXT_WINDOW &&
        slidingWindowMatch(squashedNote, squashedOption, ANSWER_TEXT_WINDOW)
      ) {
        return true;
      }
      // Short options never reach the sliding window; check them whole so
      // short CORRECT answers ("Azure Function", "A number of minutes")
      // cannot be stashed verbatim: token-bounded in the spaced form, plain
      // inclusion in the squashed form.
      if (normalizedOption.length < ANSWER_TEXT_WINDOW) {
        if (
          normalizedOption.length >= ANSWER_TEXT_MIN_PHRASE &&
          paddedNote.includes(` ${normalizedOption} `)
        ) {
          return true;
        }
        if (
          squashedOption.length >= ANSWER_TEXT_MIN_PHRASE &&
          squashedNote.includes(squashedOption)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function resolveDefeatedMisconception(
  ledger: Ledger,
  question: Question,
  misconceptions: readonly Misconception[],
): { id: string; name: string } | null {
  let misconceptionId: string | null = null;
  for (let i = ledger.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = ledger.attempts[i];
    if (
      attempt.questionId === question.id &&
      !attempt.correct &&
      attempt.misconceptionId !== null
    ) {
      misconceptionId = attempt.misconceptionId;
      break;
    }
  }
  if (misconceptionId === null) {
    for (const option of question.options) {
      if (option.misconceptionId !== undefined) {
        misconceptionId = option.misconceptionId;
        break;
      }
    }
  }
  if (misconceptionId === null) {
    return null;
  }
  for (const misconception of misconceptions) {
    if (misconception.id === misconceptionId) {
      return { id: misconception.id, name: misconception.name };
    }
  }
  return null;
}
