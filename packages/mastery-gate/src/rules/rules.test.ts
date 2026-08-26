import { test, expect } from 'bun:test';
import {
  DECISION_TREES,
  RESPONSIBILITIES,
  SIGNAL_RULES,
  ruleById,
  walkTree,
} from './rules';
import type { DecisionNode, DecisionTreeKind } from './rules';
import { evaluateTree } from './flipCondition';

test("DECISION_TREES has exactly the keys 'ui' and 'automation'", () => {
  expect(Object.keys(DECISION_TREES).sort()).toEqual(['automation', 'ui']);
});

test('walkTree visits nodes and every outcome ruleId resolves with matching startWith', () => {
  const kinds = Object.keys(DECISION_TREES) as DecisionTreeKind[];
  for (const kind of kinds) {
    const nodes: DecisionNode[] = [];
    walkTree(DECISION_TREES[kind].tree, (node) => {
      nodes.push(node);
    });
    expect(nodes.length > 0).toBe(true);
    for (const node of nodes) {
      if (node.kind !== 'outcome') {
        continue;
      }
      const rule = ruleById(node.ruleId);
      expect(rule !== undefined).toBe(true);
      if (rule) {
        expect(rule.startWith).toBe(node.component);
      }
    }
  }
});

test('every SIGNAL_RULES responsibility appears in RESPONSIBILITIES', () => {
  const names = RESPONSIBILITIES.map((entry) => entry.responsibility);
  for (const rule of SIGNAL_RULES) {
    expect(names).toContain(rule.responsibility);
  }
});

test("evaluateTree on the ui tree reaches outcome id 'ui-model'", () => {
  const result = evaluateTree(DECISION_TREES.ui.tree, {
    'ui-root': false,
    'ui-relational': true,
  });
  expect(result.outcome !== null).toBe(true);
  if (result.outcome) {
    expect(result.outcome.id).toBe('ui-model');
    expect(result.outcome.component).toBe('Model-driven app');
  }
});

test("evaluateTree on the automation tree with auto-root true reaches 'auto-copilot'", () => {
  const result = evaluateTree(DECISION_TREES.automation.tree, {
    'auto-root': true,
  });
  expect(result.outcome !== null).toBe(true);
  if (result.outcome) {
    expect(result.outcome.id).toBe('auto-copilot');
  }
});

test('evaluateTree with an empty answers object returns outcome null and errors', () => {
  const result = evaluateTree(DECISION_TREES.ui.tree, {});
  expect(result.outcome).toBe(null);
  expect(result.errors.length > 0).toBe(true);
});
