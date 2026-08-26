import { test, expect } from 'bun:test';
import type { FlipConditionScenario } from './flipCondition';
import { validateFlipConditionScenario } from './flipCondition';

function sampleUiScenario(): FlipConditionScenario {
  return {
    id: 'sample-flip-ui',
    title: 'UI tree sample flips — SAMPLE — replace with authored content',
    treeKind: 'ui',
    baselineRowId: 'row-baseline',
    note: 'Placeholder Flip-Condition table. SAMPLE — replace with authored content',
    rows: [
      {
        id: 'row-baseline',
        answers: {
          'ui-root': false,
          'ui-relational': true,
        },
        expectedOutcomeId: 'ui-model',
        expectedComponent: 'Model-driven app',
        expectedRuleId: 'related-records',
        citation: 'sample-model-driven',
      },
      {
        id: 'row-flip-external',
        answers: {
          'ui-root': true,
          'ui-relational': true,
        },
        expectedOutcomeId: 'ui-pages',
        expectedComponent: 'Power Pages',
        expectedRuleId: 'external-users',
        citation: 'sample-power-pages',
        mutatedQuestionId: 'ui-root',
      },
      {
        id: 'row-flip-relational',
        answers: {
          'ui-root': false,
          'ui-relational': false,
        },
        expectedOutcomeId: 'ui-canvas',
        expectedComponent: 'Canvas app',
        expectedRuleId: 'guided-task',
        citation: 'sample-canvas-guided',
        mutatedQuestionId: 'ui-relational',
      },
    ],
  };
}

test('sample Flip-Condition scenario validates with no errors', () => {
  expect(validateFlipConditionScenario(sampleUiScenario())).toEqual([]);
});

test('unknown treeKind is rejected', () => {
  const scenario = {
    ...sampleUiScenario(),
    treeKind: 'not-a-tree',
  } as unknown as FlipConditionScenario;
  const errors = validateFlipConditionScenario(scenario);
  expect(errors.length > 0).toBe(true);
  expect(errors.join('\n')).toContain('treeKind');
});

test('mismatched expectedOutcomeId is rejected', () => {
  const scenario = sampleUiScenario();
  scenario.rows[0] = {
    ...scenario.rows[0],
    expectedOutcomeId: 'ui-pages',
  };
  const errors = validateFlipConditionScenario(scenario);
  expect(errors.length > 0).toBe(true);
  expect(errors.join('\n')).toContain('expectedOutcomeId');
});

test('non-baseline row that flips two keys is rejected', () => {
  const scenario = sampleUiScenario();
  scenario.rows[1] = {
    ...scenario.rows[1],
    answers: {
      'ui-root': true,
      'ui-relational': false,
    },
  };
  const errors = validateFlipConditionScenario(scenario);
  expect(errors.length > 0).toBe(true);
  expect(errors.join('\n')).toContain('row-flip-external');
});

test('answers containing a question id not in the tree is rejected', () => {
  const scenario = sampleUiScenario();
  scenario.rows[0] = {
    ...scenario.rows[0],
    answers: {
      ...scenario.rows[0].answers,
      'not-in-tree': true,
    },
  };
  const errors = validateFlipConditionScenario(scenario);
  expect(errors.length > 0).toBe(true);
  expect(errors.join('\n')).toContain('not-in-tree');
});

test('baseline row with mutatedQuestionId is rejected', () => {
  const scenario = sampleUiScenario();
  scenario.rows[0] = {
    ...scenario.rows[0],
    mutatedQuestionId: 'ui-root',
  };
  const errors = validateFlipConditionScenario(scenario);
  expect(errors.length > 0).toBe(true);
  expect(errors.join('\n')).toContain('mutatedQuestionId');
});
