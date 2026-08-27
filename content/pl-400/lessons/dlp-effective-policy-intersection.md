# Reason About the Effective DLP Policy

> A policy is not a vote; it is a boundary.

_Ported from the authored PL-400 micro-lesson spec PL400-ML-09 (CC BY 4.0, see content/LICENSE)._

## Governing rule {#dlp-effective-policy-intersection-rule}

Evaluate every data policy applicable to the resource's environment together: any Blocked classification prohibits the connector, and two unblocked connectors may coexist only when their Business/Non-Business classifications match in every applicable policy.

## Exam clue {#dlp-effective-policy-intersection-exam-clue}

**Any Blocked wins; otherwise compare the whole policy fingerprint—not one label from one policy.**

Mnemonic: Blocked beats all; matching vectors mix.

## Worked scenario {#dlp-effective-policy-intersection-scenario}

A cloud flow in one environment uses SharePoint and Salesforce. Policy A classifies both as Business. Policy B classifies SharePoint as Business and Salesforce as Non-Business. Neither connector is Blocked. Will the flow comply, and what happens if it is already running when Policy B becomes applicable?

**Expected answer.** No. SharePoint has the fingerprint Business/Business while Salesforce has Business/Non-Business, so the connectors end in different effective groups and cannot be used together. At design time the conflict prevents a compliant save experience; Power Automate can save the flow but marks it Suspended. If a later policy change creates the violation, runtime enforcement also prevents execution and a background polling process marks the flow Suspended, so the change is not necessarily instantaneous.

## Production nuance {#dlp-effective-policy-intersection-production}

- Inventory every policy applicable to the resource's environment before diagnosing a connector conflict; policy names and creation order do not establish precedence.
- Treat Business and Non-Business as data-boundary groups, not as trusted and untrusted connector quality ratings.
- Assess connector pairs used by each app or flow. Looking at one connector in isolation cannot prove that the resource is compliant.
- Power Apps prevents adding a conflicting connection; Power Automate may save a violating flow but marks it Suspended and does not execute it.
- Policy changes can affect resources that were compliant when created. Because the suspension process polls, allow for propagation time before concluding that enforcement failed.
- Provide an admin contact and governance reference link in policy error experiences so makers have a supported remediation route.
- Minimize overlapping policies where practical because n binary groupings can fragment connectors into as many as 2^n effective groups.
- This lesson covers classic Power Platform data-policy combination and enforcement. It does not imply that DLP replaces Dataverse security roles, connection authorization, tenant app controls, or advanced connector policy evaluation.
