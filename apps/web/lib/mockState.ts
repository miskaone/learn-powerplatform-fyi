import type {
  Ledger,
  QuestionPublic,
  RubricScores,
} from "@learn/mastery-gate/schema";

export interface GradeVerdict {
  correct: boolean;
  misconceptionId: string | null;
  misconceptionName: string | null;
  attemptsUsed: number;
}

interface BankOption {
  id: string;
  text: string;
  misconceptionId?: string;
}

interface BankQuestion {
  id: string;
  objectiveId: string;
  concepts: string[];
  prompt: string;
  options: BankOption[];
  correctOptionId: string;
}

const MISCONCEPTION_NAME_BY_ID: Record<string, string> = {
  "client-side-enforcement-only": "Client-side enforcement only",
  "sync-plugin-for-everything": "Synchronous plugin for everything",
  "pre-image-is-live-data": "Pre-image is live data",
};

const questionBank: BankQuestion[] = [
  {
    id: "q-credit-limit-enforcement",
    objectiveId: "pl400-obj-1",
    concepts: ["plugin registration", "event pipeline", "server enforcement"],
    prompt:
      "Account updates must be rejected when they would drive Credit Limit below zero. A canvas app already validates the field on save. Where must the rule be enforced so a Web API caller cannot bypass it?",
    options: [
      {
        id: "q1-a",
        text: "Keep the rule in the canvas app OnSave formula and a form script. API callers use the same form, so the check will always run.",
        misconceptionId: "client-side-enforcement-only",
      },
      {
        id: "q1-b",
        text: "Register a plugin on the Update message for account in the Dataverse event pipeline (pre-validation or pre-operation) so every platform write is subject to the rule.",
      },
      {
        id: "q1-c",
        text: "Register a synchronous plugin on every message for account, including Retrieve and RetrieveMultiple, so nothing about the table can happen without the rule.",
        misconceptionId: "sync-plugin-for-everything",
      },
      {
        id: "q1-d",
        text: "In the plugin, read Target as the live pre-update row; a pre-image is unnecessary because Target already holds the current database values.",
        misconceptionId: "pre-image-is-live-data",
      },
    ],
    correctOptionId: "q1-b",
  },
  {
    id: "q-sync-preop-veto",
    objectiveId: "pl400-obj-1",
    concepts: ["pre-operation", "synchronous plugin", "transaction"],
    prompt:
      "The credit-limit plugin must veto the write inside the same database transaction as the Update. Which registration is the correct fit?",
    options: [
      {
        id: "q2-a",
        text: "A JavaScript web resource on the account form. If the form blocks save, Dataverse will roll back any concurrent API update too.",
        misconceptionId: "client-side-enforcement-only",
      },
      {
        id: "q2-b",
        text: "A synchronous plugin on every account message (Create, Update, Delete, Retrieve, Associate) so the veto is universal.",
        misconceptionId: "sync-plugin-for-everything",
      },
      {
        id: "q2-c",
        text: "A synchronous pre-operation (stage 20) plugin on Update of account. It runs inside the transaction and can throw to cancel the core operation.",
      },
      {
        id: "q2-d",
        text: "Read the pre-image after the core operation; it is a live cursor, so you can still cancel if creditlimit has already been written.",
        misconceptionId: "pre-image-is-live-data",
      },
    ],
    correctOptionId: "q2-c",
  },
  {
    id: "q-preimage-target",
    objectiveId: "pl400-obj-1",
    concepts: ["pre-image", "Target", "IPluginExecutionContext"],
    prompt:
      "The plugin must compute remaining credit as (prior Credit Limit) minus the incoming charge. The Update Target contains only the attributes the caller sent. How do you obtain the prior Credit Limit?",
    options: [
      {
        id: "q3-a",
        text: "Read it from the canvas app context passed into the plugin. Form state is the source of truth for column values.",
        misconceptionId: "client-side-enforcement-only",
      },
      {
        id: "q3-b",
        text: "Register a pre-image on the plugin step that includes creditlimit, then read that snapshot from PreEntityImages. Target is the inbound payload, not the current row.",
      },
      {
        id: "q3-c",
        text: "Always register the plugin as synchronous on Update and Retrieve. Retrieve will give you live values, so you never need images.",
        misconceptionId: "sync-plugin-for-everything",
      },
      {
        id: "q3-d",
        text: "Use Target[\"creditlimit\"] as the pre-update value. Target is a live view of the database row at the moment the plugin runs.",
        misconceptionId: "pre-image-is-live-data",
      },
    ],
    correctOptionId: "q3-b",
  },
];

export const publicQuestions: QuestionPublic[] = [
  {
    id: questionBank[0].id,
    objectiveId: questionBank[0].objectiveId,
    concepts: questionBank[0].concepts,
    prompt: questionBank[0].prompt,
    options: [
      {
        id: questionBank[0].options[0].id,
        text: questionBank[0].options[0].text,
      },
      {
        id: questionBank[0].options[1].id,
        text: questionBank[0].options[1].text,
      },
      {
        id: questionBank[0].options[2].id,
        text: questionBank[0].options[2].text,
      },
      {
        id: questionBank[0].options[3].id,
        text: questionBank[0].options[3].text,
      },
    ],
  },
  {
    id: questionBank[1].id,
    objectiveId: questionBank[1].objectiveId,
    concepts: questionBank[1].concepts,
    prompt: questionBank[1].prompt,
    options: [
      {
        id: questionBank[1].options[0].id,
        text: questionBank[1].options[0].text,
      },
      {
        id: questionBank[1].options[1].id,
        text: questionBank[1].options[1].text,
      },
      {
        id: questionBank[1].options[2].id,
        text: questionBank[1].options[2].text,
      },
      {
        id: questionBank[1].options[3].id,
        text: questionBank[1].options[3].text,
      },
    ],
  },
  {
    id: questionBank[2].id,
    objectiveId: questionBank[2].objectiveId,
    concepts: questionBank[2].concepts,
    prompt: questionBank[2].prompt,
    options: [
      {
        id: questionBank[2].options[0].id,
        text: questionBank[2].options[0].text,
      },
      {
        id: questionBank[2].options[1].id,
        text: questionBank[2].options[1].text,
      },
      {
        id: questionBank[2].options[2].id,
        text: questionBank[2].options[2].text,
      },
      {
        id: questionBank[2].options[3].id,
        text: questionBank[2].options[3].text,
      },
    ],
  },
];

export const misconceptionNames: Record<string, string> = {
  "client-side-enforcement-only":
    MISCONCEPTION_NAME_BY_ID["client-side-enforcement-only"],
  "sync-plugin-for-everything":
    MISCONCEPTION_NAME_BY_ID["sync-plugin-for-everything"],
  "pre-image-is-live-data": MISCONCEPTION_NAME_BY_ID["pre-image-is-live-data"],
};

export const questionHints: Record<string, string> = {
  "q-credit-limit-enforcement":
    "A caller that never opens the canvas app still has to obey this rule. Ask which layer every Dataverse write actually travels through.",
  "q-sync-preop-veto":
    "Veto means the original transaction must not commit. Which stage can throw and still share that transaction with the core Update?",
  "q-preimage-target":
    "Target lists attributes the caller sent, not the full current row. Snapshots of prior values are registered on the plugin step itself.",
};

export function gradeAnswer(
  questionId: string,
  optionId: string,
  attemptsUsed: number,
): GradeVerdict {
  const question = questionBank.find((item) => item.id === questionId);
  if (!question) {
    return {
      correct: false,
      misconceptionId: null,
      misconceptionName: null,
      attemptsUsed,
    };
  }

  const option = question.options.find((item) => item.id === optionId);
  const correct = optionId === question.correctOptionId;
  if (correct) {
    return {
      correct: true,
      misconceptionId: null,
      misconceptionName: null,
      attemptsUsed,
    };
  }

  const misconceptionId = option?.misconceptionId ?? null;
  const misconceptionName = misconceptionId
    ? (MISCONCEPTION_NAME_BY_ID[misconceptionId] ?? null)
    : null;

  return {
    correct: false,
    misconceptionId,
    misconceptionName,
    attemptsUsed,
  };
}

export interface ToolRosterEntry {
  name: string;
  description: string;
  dynamic: boolean;
}

export const staticTools: ToolRosterEntry[] = [
  {
    name: "get_learner_state",
    description:
      "Return the current ledger: phase, per-dimension rubric scores, attempts, and misconception fire counts.",
    dynamic: false,
  },
  {
    name: "get_current_context",
    description:
      "Return the visible lesson section, phase, and active question id with no answer-key fields.",
    dynamic: false,
  },
  {
    name: "navigate_to_anchor",
    description:
      "Scroll the page to a named lesson section and highlight it.",
    dynamic: false,
  },
  {
    name: "log_coaching_note",
    description:
      "Append a coach note to the ledger without changing scores or unlocking tools.",
    dynamic: false,
  },
  {
    name: "get_current_question",
    description:
      "Return the redacted public question currently on screen.",
    dynamic: false,
  },
  {
    name: "submit_answer",
    description:
      "Grade a chosen option id; on a miss, name the misconception and never the correct option.",
    dynamic: false,
  },
  {
    name: "get_hint",
    description:
      "Return the next allowed hint for the current question; refuses if no attempt has been made.",
    dynamic: false,
  },
  {
    name: "request_next_action",
    description:
      "Return the engine routing verdict for the latest attempt.",
    dynamic: false,
  },
  {
    name: "prescribe_drill",
    description:
      "Return the next drill from the weakest rubric dimension.",
    dynamic: false,
  },
  {
    name: "score_rubric",
    description:
      "Submit a per-dimension score with evidence quotes; values are clamped 0–4 and never averaged.",
    dynamic: false,
  },
];

export const dynamicTools: Record<string, ToolRosterEntry> = {
  advance_module: {
    name: "advance_module",
    description:
      "Unlock and enter the next module once every rubric dimension is at least 3.",
    dynamic: true,
  },
  get_misconception_brief: {
    name: "get_misconception_brief",
    description:
      "Return the contrast brief for a misconception that has fired at least twice.",
    dynamic: true,
  },
  reveal_outcome: {
    name: "reveal_outcome",
    description:
      "Reveal the Flip-Condition outcome after a prediction has been committed.",
    dynamic: true,
  },
  get_exam_debrief: {
    name: "get_exam_debrief",
    description: "Return the exam debrief once the exam has been submitted.",
    dynamic: true,
  },
  compose_debrief: {
    name: "compose_debrief",
    description:
      "Compose a debrief playlist from the session ledger after the module is complete.",
    dynamic: true,
  },
};

export const initialScores: RubricScores = {
  recall: 2,
  connections: 1,
  application: 2,
  transfer: 0,
};

export const initialLedger: Ledger = {
  attempts: [],
  misconceptionFires: {},
  scores: {
    recall: initialScores.recall,
    connections: initialScores.connections,
    application: initialScores.application,
    transfer: initialScores.transfer,
  },
  coachNotes: [],
  phase: "lesson",
};

export interface FlipScenario {
  id: string;
  title: string;
  baseline: string;
  assumptions: { id: string; text: string }[];
  outcomes: Record<string, { outcome: string; explanation: string }>;
}

export const flipScenario: FlipScenario = {
  id: "flip-credit-limit-preop",
  title: "Credit-limit plugin: flip one assumption",
  baseline:
    "A synchronous pre-operation plugin is registered on Update of account. It reads the prior Credit Limit from a registered pre-image, subtracts the incoming charge on Target, and throws InvalidPluginExecutionException when the result would be negative. The team believes this vetoes every violating update.",
  assumptions: [
    {
      id: "runs-synchronously",
      text: "The plugin runs synchronously in the same transaction as the Update.",
    },
    {
      id: "through-platform-api",
      text: "The update arrives through the Dataverse platform API, so the event pipeline actually executes.",
    },
    {
      id: "preimage-has-prior-values",
      text: "The registered pre-image contains the pre-update Credit Limit.",
    },
  ],
  outcomes: {
    "runs-synchronously": {
      outcome: "Rule silently bypassed",
      explanation:
        "Flip the registration to asynchronous post-operation and the plugin no longer shares a transaction with the core Update. The write commits first; the async job runs later on a snapshot. Throwing from that job cannot roll back the original credit change. The account is already below the limit, and the rule has become a delayed notification rather than a veto. Any compensation update you issue from the async plugin is a second write, subject to races, retries, and callers who already observed the committed row.",
    },
    "through-platform-api": {
      outcome: "Rule silently bypassed",
      explanation:
        "The pipeline only runs for messages that Dataverse actually dispatches. Privilege BypassCustomPluginExecution, some bulk-import paths with step execution disabled, and internal platform updates that never raise Update of account will change creditlimit without invoking your step. The plugin assembly is fine; it simply never entered. Client-side form logic does not close this hole, because those callers never opened a form. Enforcement that lives only in the pipeline is only as wide as the messages you registered and the callers who cannot skip plugins.",
    },
    "preimage-has-prior-values": {
      outcome: "Operation fails with an error",
      explanation:
        "If the step has no pre-image (or the image omits creditlimit), PreEntityImages does not hold the prior value. Target on Update is the inbound payload: a partial attribute bag, not a live row. Reading Target[\"creditlimit\"] as the previous balance either misses the column entirely when the caller did not send it, or treats the new value as if it were the old one. The usual result is a null-reference or invalid-cast inside the plugin, which surfaces as a fault to the caller — or, worse, a skipped comparison that lets the write through. The pre-image is a registered snapshot, not a query against current SQL.",
    },
  },
};

export const lessonSections: { id: string; title: string; body: string[] }[] = [
  {
    id: "where-it-executes",
    title: "Where a plugin executes",
    body: [
      "A Dataverse plugin is a .NET class that implements IPlugin. The platform constructs it and calls Execute(IServiceProvider) when a registered message reaches the event pipeline. That pipeline lives on the server, inside the Dataverse organization service. It is not the canvas-app formula engine, not a model-driven form script, and not a Power Automate flow. Those surfaces can run complementary checks, but they are not the same transaction and they are not on the same call path.",
      "Registration is what binds the class to traffic. In the Plugin Registration Tool (or equivalent solution metadata) you choose the message (Update, Create, Delete, and so on), the primary entity, the pipeline stage, and whether the step is synchronous. You also choose the filtering attributes: an Update step that lists creditlimit will not fire when a caller changes telephone1 alone. If the rule must hold for every writer, the step has to match the messages those writers actually send.",
      "This is why client-side enforcement is not a substitute for a plugin. A canvas app OnSave formula, a business rule, or a form library can improve the interactive experience, but a Web API PATCH, an SDK UpdateRequest, an Import, or another plugin writing through IOrganizationService never loads that form. If the credit-limit rule is not in the pipeline, those callers skip it. Server-side registration is how you put a rule on the platform's own front door.",
    ],
  },
  {
    id: "pipeline-stages",
    title: "Pipeline stages",
    body: [
      "The event pipeline is a sequence of stages around the core database operation. Pre-validation is stage 10. It runs before the transaction for the request has started, which makes it a good place for cheap argument checks that should fail fast. Because it is outside the transaction, work you do here is not automatically rolled back with the core operation, and you should not treat it as a place to write dependent rows that must commit or fail with the target record.",
      "Pre-operation is stage 20. For a synchronous step it runs inside the transaction, after security and validation, and before the core operation (stage 30) writes the row. Throwing InvalidPluginExecutionException here cancels the core operation and rolls the transaction back. You may also mutate the Target Entity so the core operation writes different values than the caller sent. That is the natural home for a credit-limit veto: you still have a chance to stop the write, and you share fate with it.",
      "Post-operation is stage 40, after the core operation. A synchronous post-operation step is still inside the transaction; an asynchronous one is not — it is queued after the transaction commits. Use post-operation for work that needs the persisted row (sharing, related-record creates that should see the new id) and use asynchronous post-operation for side effects that must not hold the user's request open. The stage you pick is a transaction design, not a style preference.",
    ],
  },
  {
    id: "images-and-context",
    title: "Images and execution context",
    body: [
      "IPluginExecutionContext is the plugin's view of the message. InputParameters[\"Target\"] is the inbound payload: for Update, an Entity that contains the attributes the caller supplied, not a fully loaded row. ParentContext, MessageName, PrimaryEntityName, Depth, and UserId tell you who called, on which message, and whether you are already inside another plugin. Depth is the usual guard against infinite update loops when your plugin writes back to Dataverse.",
      "Images are snapshots the platform takes because you asked it to, on the plugin step. A pre-image is the record as it existed before the core operation, limited to the columns you registered. A post-image is the record after the core operation. Neither image is a live IOrganizationService retrieve. They do not change if another thread updates the row, and they do not include columns you omitted from the image registration. If creditlimit is not in the pre-image, it is not there — even though the table still has a value.",
      "The common failure is to treat Target as the pre-update row. Target on Update is a patch. If the caller sends only transactionamount, Target[\"creditlimit\"] is missing; the prior balance is in the pre-image (or in a retrieve you explicitly issue). If the caller does send creditlimit, that value is the proposed new amount, not the previous one. Pre-images exist so you can compare before and after without guessing which attributes arrived in the payload.",
    ],
  },
  {
    id: "sync-vs-async",
    title: "Synchronous versus asynchronous plugins",
    body: [
      "A synchronous plugin runs on the request thread, inside the pipeline stage you registered, before the caller receives a response. It can throw and, in pre-operation or synchronous post-operation, participate in the request transaction. It is also budgeted: the platform enforces a two-minute execution limit, and every millisecond you spend is latency the user (or the API caller) pays. Synchronous is the right tool when the business rule must be true before the operation is considered successful — a credit-limit veto, a required related-record invariant, a mutation of Target the core operation must see.",
      "An asynchronous plugin is queued after the transaction commits. It cannot cancel the original write. It can fail on its own, retry, and be inspected in System Jobs. It is the right tool for outbound notifications, expensive fan-out, and anything that would make the user's save feel like a batch job. Registering the credit-limit rule as asynchronous quietly turns a veto into a post-hoc cleanup, which is a different product with different failure modes.",
      "The trap is to make every plugin synchronous \"so it is reliable.\" Reliability and veto power are not the same thing. Synchronous Retrieve plugins, synchronous steps on high-volume messages, and synchronous work that calls external HTTP endpoints hold locks and threads the platform needs for everyone else. Prefer asynchronous for side effects; reserve synchronous for rules that must share a transaction with the core operation. The credit-limit plugin is the latter. Most telemetry, indexing, and integration plugins are the former.",
    ],
  },
];
