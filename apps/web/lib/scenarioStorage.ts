/**
 * Commit-before-reveal storage for the lesson scenario sections. One key per
 * lesson so a lesson-scoped reset can clear exactly its own commitment
 * (cross-review finding 10).
 */
export function scenarioStorageKey(slug: string): string {
  return `mastery-gate:lesson:${slug}:scenario`;
}

export function readScenarioCommit(slug: string): { text: string } | null {
  try {
    const raw = localStorage.getItem(scenarioStorageKey(slug));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as { committed?: unknown; text?: unknown };
    if (record.committed !== true || typeof record.text !== "string") {
      return null;
    }
    return { text: record.text };
  } catch {
    return null;
  }
}

export function persistScenarioCommit(slug: string, text: string): void {
  try {
    localStorage.setItem(
      scenarioStorageKey(slug),
      JSON.stringify({
        committed: true,
        text,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearScenarioCommit(slug: string): void {
  try {
    localStorage.removeItem(scenarioStorageKey(slug));
  } catch {
    // ignore
  }
}

/** Track-wide reset support: clear every lesson's scenario commitment. */
export function clearAllScenarioCommits(slugs: readonly string[]): void {
  for (const slug of slugs) {
    clearScenarioCommit(slug);
  }
}
