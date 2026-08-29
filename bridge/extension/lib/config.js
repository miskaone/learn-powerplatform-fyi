// Single-origin allowlist — a const so the extension can never be pointed at
// another site. Matches host_permissions in manifest.json; never <all_urls>.
export const ALLOWED_ORIGIN = 'https://learn.powerplatform.fyi';

export const DEFAULT_PORT = 8765;

// Mirror of the server cap in bridge/server/protocol.ts.
export const MAX_WS_MESSAGE_BYTES = 1_000_000;

export const REQUEST_TIMEOUT_MS = 10_000;

export const RELAY_SOURCE_TO_PAGE = 'webmcp-bridge:to-page';
export const RELAY_SOURCE_FROM_PAGE = 'webmcp-bridge:from-page';
