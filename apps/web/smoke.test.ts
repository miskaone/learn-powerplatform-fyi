import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

test("static export config and pl-400 page exist", async () => {
  const config = await Bun.file(join(import.meta.dir, "next.config.ts")).text();
  expect(config).toContain('output: "export"');
  expect(existsSync(join(import.meta.dir, "app/pl-400/page.tsx"))).toBe(true);
});
