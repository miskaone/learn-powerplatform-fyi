import type {
  ContentManifest,
  DrillResultRecord,
  Ledger,
} from '../schema';
import type { FlipConditionScenario } from '../rules/flipCondition';
import { evaluateTree } from '../rules/flipCondition';
import type { DecisionNode } from '../rules/rules';
import { DECISION_TREES, walkTree } from '../rules/rules';
import { cloneLedger } from './ledger';

export const MAX_PREDICTION_LENGTH = 500;
export const MAX_PREDICTION_REASON_LENGTH = 500;

export interface DrillAssumptionPublic {
  id: string;
  text: string;
}

export interface StartDrillResult {
  scenarioId: string;
  title: string;
  round: number;
  assumptions: DrillAssumptionPublic[];
}

export interface MutateResult {
  accepted: boolean;
  scenarioId: string;
  round: number;
  assumptionText: string;
  refusalReason: string | null;
}

export interface CommitResult {
  committed: boolean;
  scenarioId: string;
  refusalReason: string | null;
}

export interface RevealResult {
  outcomeId: string;
  outcomeComponent: string;
  predictionWasCorrect: boolean;
  explanationAnchor: string;
  record: DrillResultRecord;
  sessionComplete: boolean;
}

function scenariosOf(manifest: ContentManifest): FlipConditionScenario[] {
  return manifest.flipScenarios ?? [];
}

function findScenario(
  scenarios: FlipConditionScenario[],
  scenarioId: string,
): FlipConditionScenario | null {
  for (const scenario of scenarios) {
    if (scenario.id === scenarioId) {
      return scenario;
    }
  }
  return null;
}

function mutatableAssumptionIds(scenario: FlipConditionScenario): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of scenario.rows) {
    if (row.id === scenario.baselineRowId) {
      continue;
    }
    const assumptionId = row.mutatedQuestionId;
    if (typeof assumptionId !== 'string' || seen.has(assumptionId)) {
      continue;
    }
    seen.add(assumptionId);
    ids.push(assumptionId);
  }
  return ids;
}

function findQuestionNode(
  tree: DecisionNode,
  questionId: string,
): Extract<DecisionNode, { kind: 'question' }> | null {
  let found: Extract<DecisionNode, { kind: 'question' }> | null = null;
  walkTree(tree, (node) => {
    if (node.kind === 'question' && node.id === questionId) {
      found = node;
    }
  });
  return found;
}

function assumptionText(
  scenario: FlipConditionScenario,
  assumptionId: string,
): string {
  const tree = DECISION_TREES[scenario.treeKind].tree;
  const node = findQuestionNode(tree, assumptionId);
  if (node === null) {
    return '';
  }
  return node.lines.join(' ');
}

function publicAssumptions(
  scenario: FlipConditionScenario,
): DrillAssumptionPublic[] {
  return mutatableAssumptionIds(scenario).map((id) => {
    return { id, text: assumptionText(scenario, id) };
  });
}

function toStartResult(
  scenario: FlipConditionScenario,
  round: number,
): StartDrillResult {
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    round,
    assumptions: publicAssumptions(scenario),
  };
}

function countCompletions(ledger: Ledger, scenarioId: string): number {
  let count = 0;
  for (const record of ledger.drillResults) {
    if (record.scenarioId === scenarioId) {
      count += 1;
    }
  }
  return count;
}

/** Fewest completed drillResults by scenarioId; ties keep manifest order. */
export function selectScenario(
  scenarios: FlipConditionScenario[],
  ledger: Ledger,
): FlipConditionScenario {
  let selected = scenarios[0];
  let fewest = countCompletions(ledger, selected.id);
  for (let index = 1; index < scenarios.length; index += 1) {
    const candidate = scenarios[index];
    const count = countCompletions(ledger, candidate.id);
    if (count < fewest) {
      selected = candidate;
      fewest = count;
    }
  }
  return selected;
}

function mutateRefusal(
  scenarioId: string,
  round: number,
  reason: string,
): MutateResult {
  return {
    accepted: false,
    scenarioId,
    round,
    assumptionText: '',
    refusalReason: reason,
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function applyStartDrill(
  manifest: ContentManifest,
  ledger: Ledger,
  scenarioId?: string,
): { ledger: Ledger; result: StartDrillResult } {
  const scenarios = scenariosOf(manifest);
  if (scenarios.length === 0) {
    throw new Error('refused: no-scenarios');
  }
  if (ledger.exam !== null && !ledger.exam.submitted) {
    throw new Error('refused: exam-active');
  }

  const active = ledger.activeDrill;
  if (active !== null) {
    if (scenarioId !== undefined && scenarioId !== active.scenarioId) {
      throw new Error('refused: drill-already-active');
    }
    const scenario = findScenario(scenarios, active.scenarioId);
    if (scenario === null) {
      throw new Error('refused: unknown-scenario');
    }
    return { ledger, result: toStartResult(scenario, active.round) };
  }

  let scenario: FlipConditionScenario;
  if (scenarioId !== undefined) {
    const found = findScenario(scenarios, scenarioId);
    if (found === null) {
      throw new Error('refused: unknown-scenario');
    }
    scenario = found;
  } else {
    scenario = selectScenario(scenarios, ledger);
  }

  const next = cloneLedger(ledger);
  next.activeDrill = {
    scenarioId: scenario.id,
    round: 1,
    usedAssumptionIds: [],
    currentAssumptionId: null,
    prediction: null,
  };
  next.phase = 'drill';
  return { ledger: next, result: toStartResult(scenario, 1) };
}

export function applyMutateAssumption(
  manifest: ContentManifest,
  ledger: Ledger,
  scenarioId: string,
  assumptionId: string,
): { ledger: Ledger; result: MutateResult } {
  const active = ledger.activeDrill;
  if (active === null) {
    return {
      ledger,
      result: mutateRefusal(scenarioId, 0, 'no-active-drill'),
    };
  }
  if (scenarioId !== active.scenarioId) {
    return {
      ledger,
      result: mutateRefusal(scenarioId, active.round, 'scenario-not-active'),
    };
  }
  if (active.currentAssumptionId !== null) {
    return {
      ledger,
      result: mutateRefusal(
        active.scenarioId,
        active.round,
        'mutation-already-made-this-round',
      ),
    };
  }

  const scenario = findScenario(scenariosOf(manifest), active.scenarioId);
  if (scenario === null) {
    return {
      ledger,
      result: mutateRefusal(scenarioId, active.round, 'unknown-assumption'),
    };
  }

  const mutables = mutatableAssumptionIds(scenario);
  if (!mutables.includes(assumptionId)) {
    return {
      ledger,
      result: mutateRefusal(active.scenarioId, active.round, 'unknown-assumption'),
    };
  }
  if (active.usedAssumptionIds.includes(assumptionId)) {
    return {
      ledger,
      result: mutateRefusal(
        active.scenarioId,
        active.round,
        'assumption-already-revealed',
      ),
    };
  }

  const next = cloneLedger(ledger);
  if (next.activeDrill === null) {
    return {
      ledger,
      result: mutateRefusal(scenarioId, 0, 'no-active-drill'),
    };
  }
  next.activeDrill.currentAssumptionId = assumptionId;
  return {
    ledger: next,
    result: {
      accepted: true,
      scenarioId: active.scenarioId,
      round: active.round,
      assumptionText: assumptionText(scenario, assumptionId),
      refusalReason: null,
    },
  };
}

export function applyCommitPrediction(
  ledger: Ledger,
  scenarioId: string,
  prediction: string,
  reason: string,
): { ledger: Ledger; result: CommitResult } {
  const active = ledger.activeDrill;
  if (active === null) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId,
        refusalReason: 'no-active-drill',
      },
    };
  }
  if (scenarioId !== active.scenarioId) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId,
        refusalReason: 'scenario-not-active',
      },
    };
  }
  if (active.currentAssumptionId === null) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId: active.scenarioId,
        refusalReason: 'no-mutation-this-round',
      },
    };
  }
  if (active.prediction !== null) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId: active.scenarioId,
        refusalReason: 'prediction-already-committed',
      },
    };
  }

  const trimmedReason = reason.trim();
  const trimmedPrediction = prediction.trim();
  if (trimmedReason.length === 0) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId: active.scenarioId,
        refusalReason: 'reason-required',
      },
    };
  }
  if (trimmedPrediction.length === 0) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId: active.scenarioId,
        refusalReason: 'prediction-required',
      },
    };
  }

  const next = cloneLedger(ledger);
  if (next.activeDrill === null) {
    return {
      ledger,
      result: {
        committed: false,
        scenarioId,
        refusalReason: 'no-active-drill',
      },
    };
  }
  next.activeDrill.prediction = {
    text: trimmedPrediction.slice(0, MAX_PREDICTION_LENGTH),
    reason: trimmedReason.slice(0, MAX_PREDICTION_REASON_LENGTH),
  };
  return {
    ledger: next,
    result: {
      committed: true,
      scenarioId: active.scenarioId,
      refusalReason: null,
    },
  };
}

export function applyRevealOutcome(
  manifest: ContentManifest,
  ledger: Ledger,
  scenarioId: string,
  now: number,
): { ledger: Ledger; result: RevealResult } {
  const active = ledger.activeDrill;
  if (active === null) {
    throw new Error('refused: no-active-drill');
  }
  if (scenarioId !== active.scenarioId) {
    throw new Error('refused: scenario-not-active');
  }
  if (active.prediction === null) {
    throw new Error('refused: prediction-not-committed');
  }
  if (active.currentAssumptionId === null) {
    throw new Error('refused: prediction-not-committed');
  }

  const scenario = findScenario(scenariosOf(manifest), active.scenarioId);
  if (scenario === null) {
    throw new Error('refused: unknown-scenario');
  }

  const assumptionId = active.currentAssumptionId;
  const row = scenario.rows.find(
    (candidate) => candidate.mutatedQuestionId === assumptionId,
  );
  if (row === undefined) {
    throw new Error('refused: unknown-assumption');
  }

  const tree = DECISION_TREES[scenario.treeKind].tree;
  const evaluation = evaluateTree(tree, row.answers);
  if (evaluation.outcome === null) {
    throw new Error('refused: unknown-assumption');
  }

  const outcomeId = evaluation.outcome.id;
  const outcomeComponent = evaluation.outcome.component;
  const predictionWasCorrect = normalize(active.prediction.text).includes(
    normalize(outcomeComponent),
  );

  const record: DrillResultRecord = {
    scenarioId: active.scenarioId,
    assumptionId,
    prediction: active.prediction.text,
    reason: active.prediction.reason,
    outcomeId,
    outcomeComponent,
    predictionWasCorrect,
    dimension: 'transfer',
    timestamp: now,
  };

  const usedAssumptionIds = [...active.usedAssumptionIds, assumptionId];
  const complete = mutatableAssumptionIds(scenario).every((id) =>
    usedAssumptionIds.includes(id),
  );

  const next = cloneLedger(ledger);
  next.drillResults = [...next.drillResults, record];
  if (complete) {
    next.activeDrill = null;
    next.phase = 'practice';
  } else if (next.activeDrill !== null) {
    next.activeDrill.usedAssumptionIds = usedAssumptionIds;
    next.activeDrill.currentAssumptionId = null;
    next.activeDrill.prediction = null;
    next.activeDrill.round = active.round + 1;
  }

  return {
    ledger: next,
    result: {
      outcomeId,
      outcomeComponent,
      predictionWasCorrect,
      explanationAnchor: row.citation,
      record,
      sessionComplete: complete,
    },
  };
}

export function applyEndDrill(ledger: Ledger): Ledger {
  if (ledger.activeDrill === null) {
    return ledger;
  }
  const next = cloneLedger(ledger);
  next.activeDrill = null;
  next.phase = 'practice';
  return next;
}
