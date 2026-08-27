import type { RegistrySnapshot, ToolName } from "@learn/mastery-gate/webmcp";

/** Non-blocking Tool Roster error line shown when a registry sync rejects. */
export const SYNC_ERROR_NOTICE = "tool sync error — see console";

export interface RosterSyncRegistry {
  sync(snapshot: RegistrySnapshot): Promise<void>;
  getRegisteredNames(): ToolName[];
}

export interface RosterSyncHandlers {
  /** Called with the registry's canonical roster after a successful sync. */
  onNames: (names: ToolName[]) => void;
  /** Called with SYNC_ERROR_NOTICE when the sync rejects. */
  onSyncError: (notice: string) => void;
  /** Called on success — clears any prior error state. */
  onSyncOk: () => void;
  /** Runs after a successful sync (e.g. watcher.refresh()). */
  afterSync?: () => void;
}

/**
 * Drives one registry sync and routes the outcome to the UI. A rejected
 * sync must never be swallowed: a failed registerTool would otherwise
 * silently freeze the roster mid-demo, so the rejection is logged with
 * tool/registry context AND surfaced as a non-blocking roster notice.
 */
export function syncRegistryRoster(
  registry: RosterSyncRegistry,
  snapshot: RegistrySnapshot,
  handlers: RosterSyncHandlers,
): Promise<void> {
  return registry.sync(snapshot).then(
    () => {
      handlers.onSyncOk();
      handlers.onNames(registry.getRegisteredNames());
      handlers.afterSync?.();
    },
    (error: unknown) => {
      console.error("[mastery-gate] tool registry sync failed", {
        snapshot,
        registeredTools: registry.getRegisteredNames(),
        error,
      });
      handlers.onSyncError(SYNC_ERROR_NOTICE);
    },
  );
}
