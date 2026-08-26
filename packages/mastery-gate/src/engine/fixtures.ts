import type { ContentManifest, Question } from '../schema';

export const Q1_RATIONALE =
  'Plug-ins write Dataverse data through IOrganizationService inside the sandbox.';
export const Q2_RATIONALE =
  'Register the step on the PreOperation stage so validation can abort the pipeline.';
export const Q3_RATIONALE =
  'Custom connectors declare the host, path, and security definition in OpenAPI.';
export const Q4_RATIONALE =
  'API Management fronts the shared API so every consumer shares one policy boundary.';

export const FIXTURE_MANIFEST: ContentManifest = {
  courseId: 'pl-400-fixture',
  title: 'PL-400 Mastery Fixture',
  objectives: [
    {
      id: 'obj-1',
      title: 'Plug-in isolation',
      summary: 'Choose the in-process service and the right pipeline stage.',
      questionIds: ['q1', 'q2'],
    },
    {
      id: 'obj-2',
      title: 'Connector boundaries',
      summary: 'Describe how custom connectors and APIM share a contract.',
      questionIds: ['q3', 'q4'],
    },
  ],
  questions: [
    {
      id: 'q1',
      objectiveId: 'obj-1',
      concepts: ['execution pipeline', 'sandbox boundary'],
      prompt: 'Which service should a plug-in use to write Dataverse data?',
      options: [
        { id: 'q1-a', text: 'IOrganizationService' },
        {
          id: 'q1-b',
          text: 'An outbound HTTP client to the Web API',
          misconceptionId: 'mc-shared',
        },
        {
          id: 'q1-c',
          text: 'OrganizationDataService',
          misconceptionId: 'mc-q1-legacy',
        },
      ],
      correctOptionId: 'q1-a',
      rationale: Q1_RATIONALE,
      remediationAnchor: 'anchor-q1-sandbox',
    },
    {
      id: 'q2',
      objectiveId: 'obj-1',
      concepts: ['plugin stages', 'PreOperation'],
      prompt: 'When should a plug-in reject invalid input?',
      options: [
        {
          id: 'q2-a',
          text: 'In PreValidation after the transaction starts',
          misconceptionId: 'mc-q2-transaction',
        },
        { id: 'q2-b', text: 'In PreOperation before the core operation' },
        {
          id: 'q2-c',
          text: 'In PostOperation after the database commit',
          misconceptionId: 'mc-q2-post',
        },
      ],
      correctOptionId: 'q2-b',
      rationale: Q2_RATIONALE,
      remediationAnchor: 'anchor-q2-stages',
    },
    {
      id: 'q3',
      objectiveId: 'obj-2',
      concepts: ['OpenAPI', 'custom connector'],
      prompt: 'Where does a custom connector declare its host and security?',
      options: [
        {
          id: 'q3-a',
          text: 'In a plug-in that calls HttpClient',
          misconceptionId: 'mc-shared',
        },
        {
          id: 'q3-b',
          text: 'In the connector OpenAPI definition',
        },
        {
          id: 'q3-c',
          text: 'In a canvas-app formula collection',
          misconceptionId: 'mc-q3-formula',
        },
      ],
      correctOptionId: 'q3-b',
      rationale: Q3_RATIONALE,
      remediationAnchor: 'anchor-q3-openapi',
    },
    {
      id: 'q4',
      objectiveId: 'obj-2',
      concepts: ['API Management', 'shared contract'],
      prompt: 'How should several apps share one HTTP API safely?',
      options: [
        { id: 'q4-a', text: 'Place API Management in front of the host' },
        {
          id: 'q4-b',
          text: 'Embed the secret in every canvas app',
          misconceptionId: 'mc-q4-secret',
        },
        {
          id: 'q4-c',
          text: 'Call the host from a sandboxed plug-in',
          misconceptionId: 'mc-q4-plugin-http',
        },
      ],
      correctOptionId: 'q4-a',
      rationale: Q4_RATIONALE,
      remediationAnchor: 'anchor-q4-apim',
    },
  ],
  misconceptions: [
    {
      id: 'mc-shared',
      name: 'HTTP from the sandbox',
      contrast: 'In-process IOrganizationService vs outbound HTTP.',
      socraticSeeds: ['What boundary does the sandbox enforce?'],
      anchor: 'anchor-q1-sandbox',
    },
    {
      id: 'mc-q1-legacy',
      name: 'Legacy organization data service',
      contrast: 'OrganizationDataService is retired.',
      socraticSeeds: ['Which service still exists in the sandbox?'],
      anchor: 'anchor-q1-sandbox',
    },
    {
      id: 'mc-q2-transaction',
      name: 'PreValidation inside the transaction',
      contrast: 'PreValidation runs before the transaction.',
      socraticSeeds: ['When does the database transaction start?'],
      anchor: 'anchor-q2-stages',
    },
    {
      id: 'mc-q2-post',
      name: 'Reject after commit',
      contrast: 'PostOperation cannot abort the core operation.',
      socraticSeeds: ['Can PostOperation roll back the write?'],
      anchor: 'anchor-q2-stages',
    },
    {
      id: 'mc-q3-formula',
      name: 'Connector as a collection',
      contrast: 'Connectors are OpenAPI contracts, not collections.',
      socraticSeeds: ['What file describes the connector?'],
      anchor: 'anchor-q3-openapi',
    },
    {
      id: 'mc-q4-secret',
      name: 'Secrets in the app',
      contrast: 'Secrets belong behind API Management.',
      socraticSeeds: ['Who should hold the credential?'],
      anchor: 'anchor-q4-apim',
    },
    {
      id: 'mc-q4-plugin-http',
      name: 'Plug-in as HTTP client',
      contrast: 'Plug-ins should not call outbound HTTP for shared APIs.',
      socraticSeeds: ['Which runtime owns the HTTP boundary?'],
      anchor: 'anchor-q4-apim',
    },
  ],
};

export function fixtureQuestion(id: string): Question {
  const question = FIXTURE_MANIFEST.questions.find((entry) => entry.id === id);
  if (!question) {
    throw new Error(`fixture question not found: ${id}`);
  }
  return question;
}
