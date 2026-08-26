import type { Question } from '../schema';

export interface GradeResult {
  questionId: string;
  optionId: string;
  correct: boolean;
  misconceptionId: string | null;
}

export function gradeAnswer(question: Question, optionId: string): GradeResult {
  const option = question.options.find((entry) => entry.id === optionId);
  if (!option) {
    throw new RangeError(
      `Unknown optionId '${optionId}' for question '${question.id}'`,
    );
  }

  const correct = optionId === question.correctOptionId;
  const misconceptionId = correct
    ? null
    : (option.misconceptionId ?? null);

  return {
    questionId: question.id,
    optionId,
    correct,
    misconceptionId,
  };
}
