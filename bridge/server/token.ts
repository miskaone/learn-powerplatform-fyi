import { timingSafeEqual } from 'node:crypto';

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

// HMAC-SHA256(key, message) as lowercase hex. Both sides of the WS handshake
// derive proofs this way so the pairing token itself never crosses the wire:
// the server proves possession first (serverProof), the extension second
// (clientProof). Uses WebCrypto so the exact same code path runs in Bun and in
// the extension service worker.
export async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Buffer.from(new Uint8Array(sig)).toString('hex');
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
