import { test, expect } from 'bun:test';
import { MasteryEngine } from './engine';
import { FIXTURE_MANIFEST } from './fixtures';
import { MemoryStorageAdapter, STORAGE_KEY } from './storage';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSubmission(rng: () => number): unknown {
  const roll = rng();
  if (roll < 0.08) {
    return null;
  }
  if (roll < 0.16) {
    return { recall: { score: rng() * 5, quote: 'partial' } };
  }
  return {
    recall: { score: rng() * 6 - 1, quote: `recall-${Math.floor(rng() * 10)}` },
    connections: {
      score: rng() * 6 - 1,
      quote: `connections-${Math.floor(rng() * 10)}`,
    },
    application: {
      score: rng() * 6 - 1,
      quote: `application-${Math.floor(rng() * 10)}`,
    },
    transfer: {
      score: rng() * 6 - 1,
      quote: `transfer-${Math.floor(rng() * 10)}`,
    },
  };
}

function runScript(seed: number): { outputs: string[]; stored: string | null } {
  const rng = mulberry32(seed);
  let t = 1000;
  const adapter = new MemoryStorageAdapter();
  const engine = new MasteryEngine(FIXTURE_MANIFEST, adapter, {
    now: () => t,
  });
  const outputs: string[] = [];

  for (let i = 0; i < 30; i += 1) {
    const kind = Math.floor(rng() * 4);
    let result: unknown;
    if (kind === 0) {
      const current = engine.getCurrentQuestion();
      if (current === null) {
        result = { skipped: 'no current question' };
      } else {
        const index = Math.floor(rng() * current.options.length);
        result = engine.submitAnswer(current.options[index].id);
      }
    } else if (kind === 1) {
      result = engine.requestHint();
    } else if (kind === 2) {
      const confidence: 'low' | 'high' = rng() < 0.5 ? 'low' : 'high';
      result = engine.requestNextAction(confidence);
    } else {
      result = engine.scoreRubric(randomSubmission(rng));
    }
    outputs.push(JSON.stringify(result));
    t += 1;
  }

  return {
    outputs,
    stored: adapter.getItem(STORAGE_KEY),
  };
}

test('same seeded script yields identical results on two engines', () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    const first = runScript(seed);
    const second = runScript(seed);
    expect(first).toEqual(second);
  }
});
