export interface UiVerdict {
  questionId: string;
  correct: boolean;
  misconceptionId: string | null;
  misconceptionName: string | null;
  attemptNumber: number;
  attemptsRemaining: number;
}

export interface ToolRosterEntry {
  name: string;
  description: string;
  dynamic: boolean;
}

export interface FlipScenario {
  id: string;
  title: string;
  baseline: string;
  assumptions: { id: string; text: string }[];
  outcomes: Record<string, { outcome: string; explanation: string }>;
}
