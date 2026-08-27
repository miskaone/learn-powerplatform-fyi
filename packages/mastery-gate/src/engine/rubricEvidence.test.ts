import { test, expect } from 'bun:test';
import { validateRubricSubmission } from './rubricEvidence';

const quotes = {
  recall: 'the sandbox hosts IOrganizationService',
  connections: 'PreOperation sits before the core write',
  application: 'OpenAPI lists the host and security',
  transfer: 'API Management is the shared front door',
};

function submission(overrides?: {
  recall?: { score: unknown; quote: unknown };
  connections?: { score: unknown; quote: unknown };
  application?: { score: unknown; quote: unknown };
  transfer?: { score: unknown; quote: unknown };
}): Record<string, unknown> {
  return {
    recall: overrides?.recall ?? { score: 3, quote: quotes.recall },
    connections:
      overrides?.connections ?? { score: 3, quote: quotes.connections },
    application:
      overrides?.application ?? { score: 3, quote: quotes.application },
    transfer: overrides?.transfer ?? { score: 3, quote: quotes.transfer },
  };
}

test('valid submission is ok with exact scores', () => {
  const result = validateRubricSubmission(submission());
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.scores).toEqual({
    recall: 3,
    connections: 3,
    application: 3,
    transfer: 3,
  });
});

test('missing quote on one dimension names that dimension', () => {
  const input = submission({
    application: { score: 2, quote: undefined },
  });
  const result = validateRubricSubmission(input);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.errors.length === 1).toBe(true);
  expect(result.errors[0]).toContain('application');
});

test('whitespace quote is an error', () => {
  const result = validateRubricSubmission(
    submission({ recall: { score: 3, quote: '   ' } }),
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.errors[0]).toContain('recall');
});

test('non-number score is an error', () => {
  const result = validateRubricSubmission(
    submission({ transfer: { score: '3', quote: quotes.transfer } }),
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.errors[0]).toContain('transfer');
});

test('missing dimension is an error naming it', () => {
  const input = submission();
  delete input.connections;
  const result = validateRubricSubmission(input);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.errors[0]).toContain('connections');
});

test('score 7 clamps to 4', () => {
  const result = validateRubricSubmission(
    submission({ recall: { score: 7, quote: quotes.recall } }),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.scores.recall).toBe(4);
});

test('score -3 clamps to 0', () => {
  const result = validateRubricSubmission(
    submission({ connections: { score: -3, quote: quotes.connections } }),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.scores.connections).toBe(0);
});

test('score 3.6 rounds to 4', () => {
  const result = validateRubricSubmission(
    submission({ application: { score: 3.6, quote: quotes.application } }),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.scores.application).toBe(4);
});

test('score 2.4 rounds to 2', () => {
  const result = validateRubricSubmission(
    submission({ transfer: { score: 2.4, quote: quotes.transfer } }),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.scores.transfer).toBe(2);
});

test('corpus mismatch errors with the verbatim message', () => {
  const result = validateRubricSubmission(submission(), 'unrelated transcript');
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  for (const dimension of ['recall', 'connections', 'application', 'transfer']) {
    let found = false;
    for (const error of result.errors) {
      if (
        error === `${dimension}: quote is not verbatim from the session transcript`
      ) {
        found = true;
      }
    }
    expect(found).toBe(true);
  }
});

test('quote shorter than 10 chars fails even when present in the corpus', () => {
  const result = validateRubricSubmission(
    submission({ recall: { score: 3, quote: 'abc' } }),
    'abc appears in this corpus along with other text',
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.errors).toContain(
    'recall: quote is too short to be evidence (min 10 chars)',
  );
});

test('corpus containing all quotes is ok', () => {
  const corpus = [
    quotes.recall,
    quotes.connections,
    quotes.application,
    quotes.transfer,
  ].join('\n');
  const result = validateRubricSubmission(submission(), corpus);
  expect(result.ok).toBe(true);
});

test('multiple simultaneous errors are all reported', () => {
  const result = validateRubricSubmission({
    recall: { score: 3, quote: '   ' },
    application: { score: 'x', quote: quotes.application },
  });
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  const joined = result.errors.join(' | ');
  expect(joined).toContain('recall');
  expect(joined).toContain('connections');
  expect(joined).toContain('application');
  expect(joined).toContain('transfer');
  expect(result.errors.length >= 4).toBe(true);
});
