# Order an Entra-Graph Connector Integration

> Identity first; approval before access; call last.

_Ported from the authored PL-400 micro-lesson spec PL400-ML-13 (CC BY 4.0, see content/LICENSE)._

## Governing rule {#entra-graph-connector-order-rule}

For a Canvas app that calls Microsoft Graph through a custom connector on behalf of the signed-in user, register the Entra app, request Graph permissions, grant required consent, configure the connector, then call it from the app.

## Exam clue {#entra-graph-connector-order-exam-clue}

**Register → Permission → Consent → Connect → Call.**

Mnemonic: Register → Permission → Consent → Connect → Call.

## Worked scenario {#entra-graph-connector-order-scenario}

A mobile Canvas app must identify the logged-in user, inspect that user's Microsoft Entra role through Microsoft Graph, and allow only authorized administrators to manage users. Put these components in dependency order: register a Microsoft Entra application, request Graph permissions, grant administrator consent, create the custom connector, and call it from the Canvas app.

**Expected answer.** Register the Microsoft Entra application → request the required Microsoft Graph API permissions → grant administrator consent when required → create the OAuth custom connector → call the connector from the Canvas app. The app registration supplies the connector identity; permissions declare access; consent approves it; the connector encapsulates Graph/OAuth; the app consumes the connector. Because a user is signed in, this is normally delegated access. A directory role is not a permission grant or consent, and a client-side role check alone is not protected-operation enforcement.

## Production nuance {#entra-graph-connector-order-production}

- Use the exact Graph endpoint to choose least-privileged delegated permissions; do not request broad directory access by default.
- `/me/memberOf` is a signed-in-user endpoint and is delegated-access shaped; distinguish direct from transitive membership and directory roles from groups.
- Canvas app sharing, Entra directory roles, Graph permissions, consent, and Dataverse/Power Platform roles are separate controls.
- Treat client-side role checks as user-experience gates, never as the only protection for user-management actions.
