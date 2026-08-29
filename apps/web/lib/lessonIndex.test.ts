import { expect, test } from "bun:test";
import {
  lessonIndex,
  lessonSectionAnchors,
  sectionMapEntries,
} from "./lessonIndex";

test("sectionMapEntries is a display model over the six authored anchors", () => {
  expect(lessonIndex.length).toBeGreaterThan(0);
  for (const lesson of lessonIndex) {
    const entries = sectionMapEntries(lesson.slug);
    expect(entries).toHaveLength(6);
    expect(entries.map((entry) => entry.anchor)).toEqual(
      lessonSectionAnchors(lesson.slug),
    );
    for (const entry of entries) {
      expect(entry.shortLabel.length).toBeGreaterThan(0);
      expect(entry.shortLabel).not.toContain(" — ");
      expect(entry.title.length).toBeGreaterThan(0);
    }
  }
});
