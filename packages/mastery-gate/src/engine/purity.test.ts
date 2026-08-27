import { test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  "from 'react'",
  'from "react"',
  'fetch(',
  'XMLHttpRequest',
  'window.',
  'document.',
  'localStorage',
  'average',
  'mean(',
];

test('engine source has no React, network, DOM, or forbidden reduction words', () => {
  const engineDir = import.meta.dir;
  const files = readdirSync(engineDir).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  );
  expect(files.length > 0).toBe(true);

  for (const name of files) {
    const source = readFileSync(join(engineDir, name), 'utf8');
    for (const pattern of FORBIDDEN) {
      if (pattern === 'localStorage' && name === 'storage.ts') {
        continue;
      }
      const present = source.includes(pattern);
      if (present) {
        throw new Error(`${name} contains forbidden pattern: ${pattern}`);
      }
      expect(present).toBe(false);
    }
  }
});
