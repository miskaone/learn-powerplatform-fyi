import type { EngineFacade } from "@learn/mastery-gate/webmcp";

/**
 * Wraps the engine facade so every successful mutating call notifies the
 * host (registry re-sync + UI refresh). Notify fires AFTER the inner call
 * returns — a method that throws must NOT notify, so agent-driven failures
 * never trigger a phantom resync.
 */
export class NotifyingFacade implements EngineFacade {
  constructor(
    private readonly inner: EngineFacade,
    private readonly notify: () => void,
  ) {}

  getLearnerState() {
    return this.inner.getLearnerState();
  }

  getCurrentContext() {
    return this.inner.getCurrentContext();
  }

  getCurrentQuestion() {
    return this.inner.getCurrentQuestion();
  }

  submitAnswer(questionId: string, optionId: string) {
    const result = this.inner.submitAnswer(questionId, optionId);
    this.notify();
    return result;
  }

  getHint(questionId: string) {
    const result = this.inner.getHint(questionId);
    this.notify();
    return result;
  }

  requestNextAction(confidence?: "low" | "high") {
    return this.inner.requestNextAction(confidence);
  }

  prescribeDrill() {
    return this.inner.prescribeDrill();
  }

  scoreRubric(submission: Parameters<EngineFacade["scoreRubric"]>[0]) {
    const result = this.inner.scoreRubric(submission);
    this.notify();
    return result;
  }

  setLessonAim(aim: string) {
    const result = this.inner.setLessonAim(aim);
    if (result.stored === true) {
      this.notify();
    }
    return result;
  }

  setRuleCompression(text: string) {
    const result = this.inner.setRuleCompression(text);
    if (result.stored === true) {
      this.notify();
    }
    return result;
  }

  setRunCommitment(text: string) {
    const result = this.inner.setRunCommitment(text);
    if (result.stored === true) {
      this.notify();
    }
    return result;
  }

  logCoachingNote(
    note: string,
    kind?: "observation" | "preference" | "context",
  ) {
    const result = this.inner.logCoachingNote(note, kind);
    if (result.stored === true) {
      this.notify();
    }
    return result;
  }

  navigateToAnchor(anchor: string) {
    return this.inner.navigateToAnchor(anchor);
  }

  getMisconceptionBrief(misconceptionId: string) {
    return this.inner.getMisconceptionBrief(misconceptionId);
  }

  mutateAssumption(scenarioId: string, assumptionId: string) {
    const result = this.inner.mutateAssumption(scenarioId, assumptionId);
    this.notify();
    return result;
  }

  commitPrediction(scenarioId: string, prediction: string, reason: string) {
    const result = this.inner.commitPrediction(scenarioId, prediction, reason);
    this.notify();
    return result;
  }

  revealOutcome(scenarioId: string) {
    const result = this.inner.revealOutcome(scenarioId);
    this.notify();
    return result;
  }

  startExam() {
    const result = this.inner.startExam();
    this.notify();
    return result;
  }

  getExamStatus() {
    // Expiry also materializes on the next mutating call or poll refresh.
    return this.inner.getExamStatus();
  }

  submitExam() {
    const result = this.inner.submitExam();
    this.notify();
    return result;
  }

  getExamDebrief() {
    return this.inner.getExamDebrief();
  }

  advanceModule() {
    const result = this.inner.advanceModule();
    this.notify();
    return result;
  }

  getFiredMisconceptionIds() {
    return this.inner.getFiredMisconceptionIds();
  }

  composeDebrief(segments: Parameters<EngineFacade["composeDebrief"]>[0]) {
    const result = this.inner.composeDebrief(segments);
    this.notify();
    return result;
  }

  getNarrationScript() {
    return this.inner.getNarrationScript();
  }

  advanceSegment(segmentId: string) {
    const result = this.inner.advanceSegment(segmentId);
    this.notify();
    return result;
  }

  getRegistrySnapshot() {
    return this.inner.getRegistrySnapshot();
  }
}
