import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("static export config and pl-400 page exist", async () => {
  const config = await Bun.file(join(import.meta.dir, "next.config.ts")).text();
  expect(config).toContain('output: "export"');
  expect(existsSync(join(import.meta.dir, "app/pl-400/page.tsx"))).toBe(true);
});

test("no component imports mockState", async () => {
  const dir = join(import.meta.dir, "components");
  for (const file of readdirSync(dir)) {
    const text = await Bun.file(join(dir, file)).text();
    expect(text).not.toContain("mockState");
  }
  expect(existsSync(join(import.meta.dir, "lib/mockState.ts"))).toBe(false);
});
