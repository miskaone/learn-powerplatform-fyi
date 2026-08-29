/**
 * Capped exponential backoff: min(base * 2^attempt, max) + jitter in [0, jitterMs).
 * attempt is 0-based. Non-finite / negative attempt is treated as 0.
 */
export function nextBackoffMs(attempt, opts = {}) {
  const base = opts.base ?? 500;
  const max = opts.max ?? 15_000;
  const jitterMs = opts.jitterMs ?? 250;
  const rand = opts.rand ?? Math.random;

  let n = Number(attempt);
  if (!Number.isFinite(n) || n < 0) n = 0;

  const raw = base * 2 ** n;
  const capped = Number.isFinite(raw) ? Math.min(raw, max) : max;
  const jitter = rand() * jitterMs;
  return capped + (Number.isFinite(jitter) ? jitter : 0);
}
