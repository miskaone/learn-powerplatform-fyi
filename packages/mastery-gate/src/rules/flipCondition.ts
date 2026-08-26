import { DECISION_TREES, ruleById, walkTree } from './rules';
import type { DecisionNode, DecisionTreeKind } from './rules';

export type OutcomeNode = Extract<DecisionNode, { kind: 'outcome' }>;

/** One row of a Flip-Condition decision table. */
export interface FlipConditionRow {
  id: string;
  /** Answer per question-node id (yes=true / no=false). May cover the whole tree. */
  answers: Record<string, boolean>;
  expectedOutcomeId: string;
  expectedComponent: string;
  expectedRuleId: string;
  /** Lesson section anchor citing why this verdict holds. Non-empty. */
  citation: string;
  /** Non-baseline rows only: the single question id whose answer flipped vs baseline. */
  mutatedQuestionId?: string;
}

export interface FlipConditionScenario {
  id: string;
  title: string;
  treeKind: DecisionTreeKind;
  baselineRowId: string;
  rows: FlipConditionRow[];
  note?: string;
}

export interface TreeEvaluation {
  outcome: OutcomeNode | null;
  visitedQuestionIds: string[];
  errors: string[];
}

const TREES: Record<string, (typeof DECISION_TREES)[DecisionTreeKind]> =
  DECISION_TREES;

export function evaluateTree(
  tree: DecisionNode,
  answers: Record<string, boolean>,
): TreeEvaluation {
  const visitedQuestionIds: string[] = [];
  const errors: string[] = [];
  let current: DecisionNode = tree;

  while (current.kind === 'question') {
    visitedQuestionIds.push(current.id);
    const answer = answers[current.id];
    if (answer !== true && answer !== false) {
      errors.push(`Missing answer for question '${current.id}'`);
      return { outcome: null, visitedQuestionIds, errors };
    }
    current = answer ? current.yes : current.no;
  }

  return { outcome: current, visitedQuestionIds, errors };
}

function differingAnswerKeys(
  baseline: Record<string, boolean>,
  candidate: Record<string, boolean>,
): string[] {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  const differing: string[] = [];
  for (const key of keys) {
    if (baseline[key] !== candidate[key]) {
      differing.push(key);
    }
  }
  return differing;
}

function questionIdsInTree(tree: DecisionNode): Set<string> {
  const ids = new Set<string>();
  walkTree(tree, (node) => {
    if (node.kind === 'question') {
      ids.add(node.id);
    }
  });
  return ids;
}

/** Returns [] when valid; otherwise human-readable error strings. */
export function validateFlipConditionScenario(
  scenario: FlipConditionScenario,
): string[] {
  const errors: string[] = [];
  const entry = TREES[scenario.treeKind];

  if (!entry) {
    errors.push(`Unknown treeKind '${String(scenario.treeKind)}'`);
    return errors;
  }

  const tree = entry.tree;
  const questionIds = questionIdsInTree(tree);

  if (!Array.isArray(scenario.rows) || scenario.rows.length === 0) {
    errors.push(`Scenario '${scenario.id}' rows is empty`);
  }

  const rows = Array.isArray(scenario.rows) ? scenario.rows : [];
  const seenRowIds = new Set<string>();
  for (const row of rows) {
    if (seenRowIds.has(row.id)) {
      errors.push(`Duplicate row id '${row.id}'`);
    }
    seenRowIds.add(row.id);
  }

  const baseline = rows.find((row) => row.id === scenario.baselineRowId);
  if (!baseline) {
    errors.push(
      `baselineRowId '${scenario.baselineRowId}' is not among rows`,
    );
  }

  for (const row of rows) {
    for (const key of Object.keys(row.answers)) {
      if (!questionIds.has(key)) {
        errors.push(
          `Row '${row.id}' answers key '${key}' is not a question-node id in the tree`,
        );
      }
    }

    const evaluation = evaluateTree(tree, row.answers);
    if (!evaluation.outcome) {
      errors.push(`Row '${row.id}' did not evaluate to an outcome`);
    } else {
      if (evaluation.outcome.id !== row.expectedOutcomeId) {
        errors.push(
          `Row '${row.id}' expectedOutcomeId does not match the evaluated outcome`,
        );
      }
      if (evaluation.outcome.component !== row.expectedComponent) {
        errors.push(
          `Row '${row.id}' expectedComponent does not match the evaluated outcome`,
        );
      }
      if (evaluation.outcome.ruleId !== row.expectedRuleId) {
        errors.push(
          `Row '${row.id}' expectedRuleId does not match the evaluated outcome`,
        );
      }
    }

    if (!ruleById(row.expectedRuleId)) {
      errors.push(`Row '${row.id}' expectedRuleId is not a known rule`);
    }

    if (typeof row.citation !== 'string' || row.citation.trim() === '') {
      errors.push(`Row '${row.id}' citation is empty`);
    }

    const isBaseline = row.id === scenario.baselineRowId;
    if (isBaseline) {
      if (row.mutatedQuestionId !== undefined) {
        errors.push(
          `Baseline row '${row.id}' must not have mutatedQuestionId`,
        );
      }
      continue;
    }

    if (
      typeof row.mutatedQuestionId !== 'string' ||
      row.mutatedQuestionId.trim() === ''
    ) {
      errors.push(`Row '${row.id}' is missing mutatedQuestionId`);
    }

    if (!baseline) {
      continue;
    }

    const flipped = differingAnswerKeys(baseline.answers, row.answers);
    if (flipped.length !== 1) {
      errors.push(
        `Row '${row.id}' answers differ from baseline in ${String(flipped.length)} keys (expected exactly one)`,
      );
    } else if (flipped[0] !== row.mutatedQuestionId) {
      errors.push(
        `Row '${row.id}' mutatedQuestionId does not match the single flipped key`,
      );
    }
  }

  return errors;
}
