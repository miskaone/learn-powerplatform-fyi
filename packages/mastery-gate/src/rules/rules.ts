/**
 * The Architecture Signals rule set.
 *
 * This module is the single source of truth for the signal matrix, the
 * responsibility table, and the decision trees. The article renders from it,
 * the diagrams lay out from it, and a future interactive walkthrough would be
 * one more renderer of the same data rather than a second transcription.
 *
 * Every decision-tree outcome carries a `ruleId` back-reference. That is what
 * makes drift detectable: see `validate.ts`.
 */

/**
 * Where a component sits architecturally.
 *
 * `surface` and `runtime` are things you build, deploy, and hand to a user (or
 * that execute without one). `invoked` capabilities only ever run *inside* one
 * of those — they answer "what should this step be", never "what should we
 * build". The article's structural note after the matrix depends on this split.
 */
export type ComponentLayer = "surface" | "runtime" | "invoked";

export interface SignalRule {
  id: string;
  /** The requirement signal, as it appears in the matrix' first column. */
  signal: string;
  /** The component to start with, as the matrix phrases it. */
  startWith: string;
  /**
   * The responsibility this rule resolves to. Must match a
   * `RESPONSIBILITIES[].responsibility` exactly — this is the explicit link
   * between the matrix and the durable layer, and what a future walkthrough
   * would traverse to explain *why* a component was chosen.
   */
  responsibility: string;
  /** What not to start with. */
  avoid: string;
  why: string;
  /** The condition that would reverse the recommendation. */
  flipsIt: string;
  layer: ComponentLayer;
}

export const SIGNAL_RULES: SignalRule[] = [
  {
    id: "related-records",
    signal: "Hundreds of related business records",
    startWith: "Model-driven app",
    responsibility: "Data experience",
    avoid: "Canvas app",
    why: "Metadata delivers forms, views, relationships, and role-based security for free",
    flipsIt:
      "One high-frequency task covers 90% of usage. Put canvas in front of the same Dataverse tables.",
    layer: "surface",
  },
  {
    id: "guided-task",
    signal: "Guided task, prescribed screen sequence",
    startWith: "Canvas app",
    responsibility: "Task experience",
    avoid: "Model-driven app",
    why: "Screen sequencing and custom UX are the product",
    flipsIt:
      "Screen count creeps past 15 to 20, or CRUD spans more than three or four related tables",
    layer: "surface",
  },
  {
    id: "external-users",
    signal: "External authenticated users",
    startWith: "Power Pages",
    responsibility: "External experience",
    avoid: "Sharing internal apps outward",
    why: "The identity boundary changed, and so did the license boundary",
    flipsIt:
      "A small, stable partner set you can license as B2B guests in your own tenant",
    layer: "surface",
  },
  {
    id: "orchestration",
    signal: "Multi-step process with waits, retries, escalation",
    startWith: "Power Automate",
    responsibility: "Process orchestration",
    avoid: "Canvas formulas",
    why: "Durable orchestration, retry, escalation, and run history",
    flipsIt:
      "Sub-second synchronous logic on save (plug-in or business rule), or a process that outlives the 30 day run duration (state in Dataverse plus a scheduled evaluator)",
    layer: "runtime",
  },
  {
    id: "conversation",
    signal: "Multi-turn conversational assistant",
    startWith: "Copilot Studio",
    responsibility: "Conversation and tool use",
    avoid: "A flow pretending to be a chatbot",
    why: "Reasoning, tool calls, grounding, and human escalation",
    flipsIt:
      "A question with one right answer that search or a query can return, or users already licensed for Microsoft 365 Copilot over the same content",
    layer: "runtime",
  },
  {
    id: "stateless-generation",
    signal: "One input, one output text generation",
    startWith: "AI prompt, called from a flow, app, or agent",
    responsibility: "Discrete AI capability",
    avoid: "A full agent",
    why: "A stateless step needs no orchestrator, no memory, and no runtime tool selection",
    flipsIt: "The task needs memory across turns or runtime tool selection",
    layer: "invoked",
  },
  {
    id: "shared-api",
    signal: "Same API called from several places",
    startWith: "Custom connector or API Management",
    responsibility: "Integration boundary",
    avoid: "HTTP actions everywhere",
    why: "Governed boundary, credential handling, DLP classification",
    flipsIt:
      "A genuine one-off with a single consumer. Do not build a connector for one caller.",
    layer: "invoked",
  },
];

export interface Responsibility {
  responsibility: string;
  component: string;
}

/**
 * The durable layer. Products get renamed, merged, and repriced;
 * responsibilities do not. The article's "memorize ten responsibilities" claim
 * is this array's length — keep them in step.
 */
export const RESPONSIBILITIES: Responsibility[] = [
  { responsibility: "System of record", component: "Dataverse" },
  { responsibility: "Data experience", component: "Model-driven app" },
  { responsibility: "Task experience", component: "Canvas app" },
  { responsibility: "External experience", component: "Power Pages" },
  { responsibility: "Process orchestration", component: "Power Automate" },
  { responsibility: "Conversation and tool use", component: "Copilot Studio" },
  {
    responsibility: "Discrete AI capability",
    component: "AI prompts and AI hub models",
  },
  {
    responsibility: "Integration boundary",
    component: "Custom connector, API Management",
  },
  {
    responsibility: "Enterprise integration",
    component: "Azure Integration Services",
  },
  {
    responsibility: "Governance and ALM",
    component: "Managed solutions, pipelines, environment strategy",
  },
];

/**
 * Decision-tree topology.
 *
 * Labels carry explicit line breaks rather than being wrapped at render time —
 * there is no text measurement available during a static server render, so
 * wrapping has to be a data decision to stay deterministic.
 */
export type DecisionNode =
  | {
      kind: "question";
      id: string;
      lines: string[];
      yes: DecisionNode;
      no: DecisionNode;
    }
  | {
      kind: "outcome";
      id: string;
      lines: string[];
      /** The component this outcome selects. Checked against the rule. */
      component: string;
      /** Back-reference into SIGNAL_RULES. Validated at build time. */
      ruleId: string;
    };

export const UI_TREE: DecisionNode = {
  kind: "question",
  id: "ui-root",
  lines: ["External users?"],
  yes: {
    kind: "outcome",
    id: "ui-pages",
    lines: ["Power Pages"],
    component: "Power Pages",
    ruleId: "external-users",
  },
  no: {
    kind: "question",
    id: "ui-relational",
    lines: ["Relationship-heavy?"],
    yes: {
      kind: "outcome",
      id: "ui-model",
      lines: ["Model-driven app"],
      component: "Model-driven app",
      ruleId: "related-records",
    },
    no: {
      kind: "outcome",
      id: "ui-canvas",
      lines: ["Canvas app"],
      component: "Canvas app",
      ruleId: "guided-task",
    },
  },
};

export const AUTOMATION_TREE: DecisionNode = {
  kind: "question",
  id: "auto-root",
  lines: ["Multi-turn", "conversation?"],
  yes: {
    kind: "outcome",
    id: "auto-copilot",
    lines: ["Copilot Studio"],
    component: "Copilot Studio",
    ruleId: "conversation",
  },
  no: {
    kind: "question",
    id: "auto-stateless",
    lines: ["One input,", "one output?"],
    yes: {
      kind: "outcome",
      id: "auto-prompt",
      lines: ["AI prompt"],
      component: "AI prompt, called from a flow, app, or agent",
      ruleId: "stateless-generation",
    },
    no: {
      kind: "outcome",
      id: "auto-flow",
      lines: ["Power Automate"],
      component: "Power Automate",
      ruleId: "orchestration",
    },
  },
};

export const DECISION_TREES = {
  ui: { tree: UI_TREE, question: "Do I need a user interface?" },
  automation: { tree: AUTOMATION_TREE, question: "Do I need automation?" },
} as const;

export type DecisionTreeKind = keyof typeof DECISION_TREES;

/** The four steps from requirement language to architecture. */
export const SIGNAL_FLOW: string[] = [
  "Requirements",
  "Signals",
  "Decision",
  "Architecture",
];

/**
 * The artifact a design review needs, and the output shape a future
 * signal-to-design walkthrough would emit. Declared here so the article's
 * worked example and any tool built later agree on the schema by construction
 * rather than by memory. Nothing consumes this yet.
 */
export interface DecisionRecord {
  requirement: string;
  /** The signals that agreed. Two is a decision; one is a hypothesis. */
  signals: { heard: string; pointsAt: string; ruleId: string }[];
  chosen: string;
  flipsIt: string;
  deferred?: string;
}

export function ruleById(id: string): SignalRule | undefined {
  return SIGNAL_RULES.find((r) => r.id === id);
}

/** Depth-first walk over a decision tree. Used by layout and validation. */
export function walkTree(
  node: DecisionNode,
  visit: (n: DecisionNode) => void,
): void {
  visit(node);
  if (node.kind === "question") {
    walkTree(node.yes, visit);
    walkTree(node.no, visit);
  }
}
