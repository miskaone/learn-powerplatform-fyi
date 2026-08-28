export interface UiVerdict {
  questionId: string;
  correct: boolean;
  misconceptionId: string | null;
  misconceptionName: string | null;
  /** Authored corrective contrast for the fired misconception, if any. */
  misconceptionContrast: string | null;
  attemptNumber: number;
  attemptsRemaining: number;
  /** Authored rationale — non-null only once the question is resolved. */
  rationale: string | null;
  /** Same-lesson remediation anchor — non-null only on a miss. */
  remediationAnchor: string | null;
  /** Named distractor-myth a correct answer defeats — non-null only on a correct verdict. */
  defeatedMisconceptionName: string | null;
}

export interface ToolRosterEntry {
  name: string;
  description: string;
  dynamic: boolean;
}
