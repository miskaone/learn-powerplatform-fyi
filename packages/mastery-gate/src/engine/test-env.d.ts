// Minimal ambient typings for the bun test runtime, used only by engine tests.
// bun provides node:fs / node:path and import.meta.dir at runtime; this package
// deliberately carries no @types/node dependency.

declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function join(...segments: string[]): string;
}

interface ImportMeta {
  /** Directory of the current module (bun runtime). */
  dir: string;
}
