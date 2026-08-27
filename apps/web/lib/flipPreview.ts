// Preview fixture only — the drill phase is quarantined until the engine drill state machine lands; no drill tools register.
import type { FlipScenario } from "./types";

export const flipPreviewScenario: FlipScenario = {
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
