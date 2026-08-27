# Design a Document Architecture for Dataverse

> Store the file for the work; route the work for the scale.

_Ported from the authored PL-400 micro-lesson spec PL400-ML-12 (CC BY 4.0, see content/LICENSE)._

## Governing rule {#bulk-document-migration-rule}

Choose document storage from the user experience and capacity requirement, match business records with stable identifiers, and choose orchestration from the workload shape. For native model-driven document management at scale, that means SharePoint, an alternate-key lookup, and recoverable batch code.

## Exam clue {#bulk-document-migration-exam-clue}

**Record context + many documents = SharePoint; initial volume = recoverable code; source ID = alternate key.**

Mnemonic: Place, match, run: SharePoint, alternate key, recoverable code.

## Worked scenario {#bulk-document-migration-scenario}

You are designing a document architecture for a model-driven app. Users must open customer documents from the correct account or contact, document binaries should not consume substantial Dataverse capacity, and an initial load may contain many files. Before choosing technology, separate three decisions: where the binary lives, how the business record is identified, and how the work is run. Apply that framework to CompanyA's Oracle migration of invoices, contracts, and identity documents: which three components are the best fit—Console Application (C#), SharePoint, and Dataverse Web API; or Azure Blob Storage, Power Automate, and Notes?

**Expected answer.** The reusable design answer is: SharePoint stores the binary for native model-driven record-context document management; the Dataverse Web API or SDK resolves the account or contact, preferably through a stable external identifier/alternate key; and the workload decides compute. For CompanyA's high-volume initial load, the keyed answer is Console Application (C#), SharePoint, and Dataverse Web API. C# provides batching, retries, checkpoints, logging, and reconciliation. Blob Storage and Power Automate can be valid in other designs, but do not provide this native, recoverable bulk-migration fit; Notes consume Dataverse capacity and are not an enterprise document repository.

## Production nuance {#bulk-document-migration-production}

- Do not begin with a tool name. First decide the storage experience, then record identity, then workload orchestration; each decision has a different owner and failure mode.
- SharePoint integration stores and manages documents in the context of model-driven app records; the document binary is in SharePoint, not Dataverse.
- Use alternate keys for data integration when a stable source identifier is available and the Dataverse GUID is not known.
- Blob Storage can be valid when custom document UI and integration are acceptable; it is not the native SharePoint document-management choice.
- Build idempotency, retries, throttling handling, source-ID preservation, logging, reconciliation, and least-privilege service authentication into bulk migration code.
