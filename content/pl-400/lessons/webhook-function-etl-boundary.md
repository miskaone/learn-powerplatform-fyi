# Separate Event Delivery from ETL Compute

> A signal starts work; compute changes data.

_Ported from the authored PL-400 micro-lesson spec PL400-ML-11 (CC BY 4.0, see content/LICENSE)._

## Governing rule {#webhook-function-etl-boundary-rule}

A Dataverse webhook delivers a Dataverse server event to an external handler; an Azure Function supplies custom compute. For an external-to-Dataverse migration, choose a trigger that originates outside Dataverse and use the Function or another ETL compute layer for transformation.

## Exam clue {#webhook-function-etl-boundary-exam-clue}

**Heavy transformation → Azure Function; event notification → webhook.**

Mnemonic: Signal triggers; compute transforms; API loads.

## Worked scenario {#webhook-function-etl-boundary-scenario}

CompanyA must retrieve existing data from legacy applications, perform complex transformation into the Dataverse schema, and load the results into Dataverse. In this exam-style component comparison, which pair is the intended answer: Webhook + Azure Function, Web Resource + Dataverse Web API, Custom Connector + Microsoft Graph, or Power Automate + Microsoft Graph? Then identify the production-direction check before implementing it.

**Expected answer.** Answer: Webhook + Azure Function. The webhook is the event-delivery mechanism and the Function performs custom transformation before loading Dataverse through the Web API or SDK. Production design must still ask where the event starts. A Dataverse webhook sends Dataverse server events outward to an external handler; it is not normally the trigger for a one-time or scheduled pull from legacy systems. In that migration shape, use a timer, pipeline, dataflow, or source-driven trigger and retain the Function where custom transformation is needed.

## Production nuance {#webhook-function-etl-boundary-production}

- Treat the exam answer as an intended component comparison: Webhook supplies event delivery and Azure Function supplies custom compute. Do not silently generalize it into a claim that every migration should start with a Dataverse webhook.
- For Dataverse event integration, register the webhook step for the intended Dataverse operation and secure the receiving endpoint. Dataverse sends a POST JSON payload to the external handler.
- For high-scale event workloads, compare Azure Service Bus: Microsoft documents queuing and higher-scale processing there, while direct webhooks scale only to the hosted handler's capacity.
- For bulk loads, design idempotency, alternate keys/upsert behavior, throttling/retry, lookup order, error logging, reconciliation, source identifiers, and service-to-service authorization separately from the trigger choice.
- A custom connector describes how Power Apps, Power Automate, Logic Apps, or agents call an API. Its optional custom code has product limits and does not make the connector a substitute for a durable ETL platform.
- A web resource is a client-side model-driven application extension. Keep browser UI customization separate from server-side migration processing even if the browser can call a Web API.
