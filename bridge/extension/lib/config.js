// Single-origin allowlist — a const so the extension can never be pointed at
// another site. Matches host_permissions in manifest.json; never <all_urls>.
export const ALLOWED_ORIGIN = 'https://learn.powerplatform.fyi';

// Exact-origin match. A prefix/startsWith test on ALLOWED_ORIGIN would also
// pass https://learn.powerplatform.fyi.evil.example and
// https://learn.powerplatform.fyi-attacker.test — parse the URL and compare
// the resolved origin instead.
export function isAllowedUrl(url) {
  try {
    return new URL(url).origin === ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

export const DEFAULT_PORT = 8765;

// Mirror of the server cap in bridge/server/protocol.ts.
export const MAX_WS_MESSAGE_BYTES = 1_000_000;

export const REQUEST_TIMEOUT_MS = 10_000;

export const RELAY_SOURCE_TO_PAGE = 'webmcp-bridge:to-page';
export const RELAY_SOURCE_FROM_PAGE = 'webmcp-bridge:from-page';
