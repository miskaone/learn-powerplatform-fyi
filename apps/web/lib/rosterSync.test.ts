import { expect, test } from "bun:test";
import type { RegistrySnapshot, ToolName } from "@learn/mastery-gate/webmcp";
import {
  SYNC_ERROR_NOTICE,
  syncRegistryRoster,
  type RosterSyncRegistry,
} from "./rosterSync";

const SNAPSHOT: RegistrySnapshot = {
  phase: "practice",
  gatePassed: false,
  repeatedMisconceptionIds: [],
  predictionCommitted: false,
  examSubmitted: false,
  moduleComplete: false,
};

function stubRegistry(sync: () => Promise<void>): RosterSyncRegistry {
  return {
    sync,
    getRegisteredNames: (): ToolName[] => ["get_learner_state", "submit_answer"],
  };
}

test("a rejected registry sync is logged and surfaced as a roster error, never swallowed", async () => {
  // Regression (cross-review finding 6): Pl400App used `.catch(() => {})`,
  // so a failed registerTool silently froze the roster mid-demo.
  const errors: string[] = [];
  let names: ToolName[] | null = null;
  let okCalls = 0;
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    await syncRegistryRoster(
      stubRegistry(() => Promise.reject(new Error("registerTool exploded"))),
      SNAPSHOT,
      {
        onNames: (n) => {
          names = n;
        },
        onSyncError: (notice) => {
          errors.push(notice);
        },
        onSyncOk: () => {
          okCalls += 1;
        },
      },
    );
  } finally {
    console.error = originalConsoleError;
  }
  expect(errors).toEqual([SYNC_ERROR_NOTICE]);
  expect(names).toBeNull();
  expect(okCalls).toBe(0);
  expect(logged.length).toBe(1);
  const [message, context] = logged[0]!;
  expect(String(message)).toContain("tool registry sync failed");
  const ctx = context as {
    snapshot: RegistrySnapshot;
    registeredTools: ToolName[];
    error: unknown;
  };
  expect(ctx.snapshot).toEqual(SNAPSHOT);
  expect(ctx.registeredTools).toEqual(["get_learner_state", "submit_answer"]);
  expect(String(ctx.error)).toContain("registerTool exploded");
});

test("a successful sync clears the error state and reports the canonical roster", async () => {
  const errors: string[] = [];
  let names: ToolName[] | null = null;
  let okCalls = 0;
  let afterCalls = 0;
  await syncRegistryRoster(stubRegistry(() => Promise.resolve()), SNAPSHOT, {
    onNames: (n) => {
      names = n;
    },
    onSyncError: (notice) => {
      errors.push(notice);
    },
    onSyncOk: () => {
      okCalls += 1;
    },
    afterSync: () => {
      afterCalls += 1;
    },
  });
  expect(errors).toEqual([]);
  expect(names).toEqual(["get_learner_state", "submit_answer"] as ToolName[]);
  expect(okCalls).toBe(1);
  expect(afterCalls).toBe(1);
});
