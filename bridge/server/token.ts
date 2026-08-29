import { timingSafeEqual } from 'node:crypto';

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

export function tokenMatches(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.byteLength !== b.byteLength) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
