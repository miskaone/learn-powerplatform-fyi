import manifestJson from "../../../content/pl-400/manifest.json";
import type { ContentManifest, RubricScores } from "@learn/mastery-gate/schema";

export const manifest = manifestJson as unknown as ContentManifest;

export const lessonSections: { id: string; title: string; body: string[] }[] = [
  {
    id: "sample-concept",
    title: "The sample concept",
    body: [
      "SAMPLE — replace with authored content. The sample concept is the named idea these placeholder items check. Keep it distinct from neighboring terms; do not collapse it into whatever word feels nearby.",
    ],
  },
  {
    id: "sample-model-driven",
    title: "Model-driven surfaces",
    body: [
      "SAMPLE — replace with authored content. When the sample concept is applied to a relationship-heavy internal situation, start from the model-driven surface and name the contrast with a guided-task surface.",
    ],
  },
  {
    id: "sample-power-pages",
    title: "External authenticated surfaces",
    body: [
      "SAMPLE — replace with authored content. When the sample concept is applied to external authenticated users, the identity boundary changed — do not share an internal app outward as a substitute.",
    ],
  },
  {
    id: "sample-canvas-guided",
    title: "Guided task sequencing",
    body: [
      "SAMPLE — replace with authored content. When the sample concept is a guided task with a prescribed screen sequence, start from a task surface and keep the contrast with a relationship-heavy records surface.",
    ],
  },
  {
    id: "sample-concept-connections",
    title: "Sample concept connections",
    body: [
      "SAMPLE — replace with authored content. The sample concept is the same idea in both placeholder objectives; only the situation around it changes. A name without a contrast does not transfer.",
    ],
  },
];

/**
 * Verbatim lesson-body sentence the agent-less "score rubric at mastery"
 * demo button submits as evidence. Must remain an exact substring of a
 * lessonSections body line or the facade's verbatim-corpus check rejects
 * the demo submission (guarded by content.test.ts).
 */
export const DEMO_MASTERY_QUOTE =
  "A name without a contrast does not transfer.";

export const DEFAULT_SCORES: RubricScores = {
  recall: 0,
  connections: 0,
  application: 0,
  transfer: 0,
};
