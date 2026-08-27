import { describe, expect, test } from "bun:test";
import { MockModelContext } from "@learn/mastery-gate/webmcp";
import { createMasteryStack } from "./masteryStack";

const POLL_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("late-binding runtime detection", () => {
  test("no runtime at creation → agent-less; runtime appearing later binds registry and fires callback", async () => {
    const host: { document?: { modelContext?: unknown } } = { document: {} };
    let detected = 0;
    const stack = createMasteryStack(
      () => {},
      () => {
        detected += 1;
      },
      host as never,
    );
    try {
      expect(stack.agentRuntimeDetected).toBe(false);
      expect(stack.registry).toBeNull();
      expect(stack.watcher).toBeNull();

      host.document!.modelContext = new MockModelContext();
      await sleep(POLL_MS + 200);

      expect(stack.agentRuntimeDetected).toBe(true);
      expect(stack.registry).not.toBeNull();
      expect(stack.watcher).not.toBeNull();
      expect(detected).toBe(1);
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });

  test("runtime present at creation binds immediately, no detection loop needed", () => {
    const host = { document: { modelContext: new MockModelContext() } };
    const stack = createMasteryStack(() => {}, undefined, host as never);
    expect(stack.agentRuntimeDetected).toBe(true);
    expect(stack.registry).not.toBeNull();
    stack.stopRuntimeDetection();
    stack.watcher?.stop();
  });

  test("stopRuntimeDetection halts the loop; later injection is not picked up", async () => {
    const host: { document?: { modelContext?: unknown } } = { document: {} };
    const stack = createMasteryStack(() => {}, undefined, host as never);
    stack.stopRuntimeDetection();
    host.document!.modelContext = new MockModelContext();
    await sleep(POLL_MS + 200);
    expect(stack.agentRuntimeDetected).toBe(false);
    expect(stack.registry).toBeNull();
  });
});
