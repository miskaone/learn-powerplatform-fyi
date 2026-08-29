import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  ALL_TOOL_NAMES,
  DYNAMIC_TOOL_NAMES,
  MockModelContext,
  STATIC_TOOL_NAMES,
  ToolRegistry,
  canonicalToolOrder,
  desiredToolNames,
  type RegistrySnapshot,
  type ToolResponse,
} from "@learn/mastery-gate/webmcp";
import {
  capText,
  formatToolResult,
  schemaToFields,
  buildToolInput,
  type InspectorField,
} from "./inspectorSchema";
import {
  QUARANTINED_TOOLS,
  createMasteryStack,
  wouldRegisterToolNames,
} from "./masteryStack";

const BASE_LESSON: RegistrySnapshot = {
  phase: "lesson",
  gatePassed: false,
  repeatedMisconceptionIds: [],
  predictionCommitted: false,
  examSubmitted: false,
  moduleComplete: false,
};

const SNAPSHOTS: RegistrySnapshot[] = [
  BASE_LESSON,
  {
    ...BASE_LESSON,
    phase: "practice",
    repeatedMisconceptionIds: ["m1"],
  },
  {
    ...BASE_LESSON,
    gatePassed: true,
  },
  {
    ...BASE_LESSON,
    phase: "drill",
  },
  {
    ...BASE_LESSON,
    phase: "drill",
    predictionCommitted: true,
  },
  {
    ...BASE_LESSON,
    phase: "exam",
  },
  {
    ...BASE_LESSON,
    phase: "exam",
    examSubmitted: true,
  },
  {
    ...BASE_LESSON,
    gatePassed: true,
    moduleComplete: true,
  },
];

function makeStack() {
  return createMasteryStack(
    () => {},
    undefined,
    { document: { modelContext: new MockModelContext() } } as never,
  );
}

function parseToolPayload(response: ToolResponse): Record<string, unknown> {
  const text = response.content[0]?.text ?? "";
  return JSON.parse(text) as Record<string, unknown>;
}

function groupField(field: InspectorField | undefined) {
  if (field === undefined || field.kind !== "group") {
    throw new Error("expected group field");
  }
  return field;
}

describe("gating fidelity", () => {
  test("wouldRegisterToolNames matches canonical desired-minus-quarantined for every snapshot", () => {
    for (const snap of SNAPSHOTS) {
      expect(wouldRegisterToolNames(snap)).toEqual(
        canonicalToolOrder(
          [...desiredToolNames(snap, "deregister")].filter(
            (name) => !QUARANTINED_TOOLS.includes(name),
          ),
        ),
      );
    }
  });

  test("live registry parity with wouldRegisterToolNames, including exam rosters", async () => {
    const stack = makeStack();
    try {
      const registry = new ToolRegistry(new MockModelContext(), stack.facade, {
        disabledTools: QUARANTINED_TOOLS,
        toolsetOverride: stack.getToolset(),
      });
      for (const snap of SNAPSHOTS) {
        await registry.sync(snap);
        expect(registry.getRegisteredNames()).toEqual(
          wouldRegisterToolNames(snap),
        );
      }
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });
});

describe("schema-form generation", () => {
  test("schemaToFields covers every real tool and specific shapes", () => {
    const stack = makeStack();
    try {
      const toolset = stack.getToolset();
      for (const name of ALL_TOOL_NAMES) {
        expect(Array.isArray(schemaToFields(toolset[name].inputSchema))).toBe(
          true,
        );
      }

      expect(schemaToFields(toolset.submit_answer.inputSchema)).toEqual([
        {
          kind: "string",
          name: "questionId",
          path: ["questionId"],
          required: true,
        },
        {
          kind: "string",
          name: "optionId",
          path: ["optionId"],
          required: true,
        },
      ]);

      expect(schemaToFields(toolset.request_next_action.inputSchema)).toEqual([
        {
          kind: "enum",
          name: "confidence",
          path: ["confidence"],
          required: false,
          values: ["low", "high"],
        },
      ]);

      expect(schemaToFields(toolset.log_coaching_note.inputSchema)).toEqual([
        { kind: "string", name: "note", path: ["note"], required: true },
        {
          kind: "enum",
          name: "kind",
          path: ["kind"],
          required: false,
          values: ["observation", "preference", "context"],
        },
      ]);

      const rubric = schemaToFields(toolset.score_rubric.inputSchema);
      expect(rubric).toHaveLength(4);
      expect(
        rubric.every(
          (field) => field.kind === "group" && field.required === true,
        ),
      ).toBe(true);
      expect(rubric.map((field) => field.name)).toEqual([
        "recall",
        "connections",
        "application",
        "transfer",
      ]);
      for (const name of [
        "recall",
        "connections",
        "application",
        "transfer",
      ] as const) {
        const group = groupField(rubric.find((field) => field.name === name));
        expect(group.children).toEqual([
          {
            kind: "number",
            name: "score",
            path: [name, "score"],
            required: true,
            minimum: 0,
            maximum: 4,
          },
          {
            kind: "string",
            name: "evidenceQuote",
            path: [name, "evidenceQuote"],
            required: true,
          },
        ]);
      }

      expect(schemaToFields(toolset.compose_debrief.inputSchema)).toEqual([
        {
          kind: "json",
          name: "segments",
          path: ["segments"],
          required: true,
        },
      ]);

      const zeroArg = [
        "get_learner_state",
        "get_current_context",
        "get_lesson_brief",
        "get_current_question",
        "prescribe_drill",
        "advance_module",
        "start_exam",
        "get_exam_status",
        "submit_exam",
        "get_exam_debrief",
        "get_narration_script",
      ] as const;
      for (const name of zeroArg) {
        expect(schemaToFields(toolset[name].inputSchema)).toEqual([]);
      }

      expect([...STATIC_TOOL_NAMES, ...DYNAMIC_TOOL_NAMES]).toEqual([
        ...ALL_TOOL_NAMES,
      ]);
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });
});

describe("buildToolInput", () => {
  test("required-field enforcement, nested rubric, optional omit, JSON fallback", () => {
    const stack = makeStack();
    try {
      const toolset = stack.getToolset();

      const submitFields = schemaToFields(toolset.submit_answer.inputSchema);
      const missing = buildToolInput(submitFields, {});
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error).toContain("questionId");
      }

      const enumFields = schemaToFields(
        toolset.request_next_action.inputSchema,
      );
      const invalidEnum = buildToolInput(enumFields, { confidence: "nope" });
      expect(invalidEnum.ok).toBe(false);
      if (!invalidEnum.ok) {
        expect(invalidEnum.error).toContain("confidence");
      }

      expect(buildToolInput(enumFields, {})).toEqual({
        ok: true,
        input: {},
      });

      const rubricFields = schemaToFields(toolset.score_rubric.inputSchema);
      const outOfRange = buildToolInput(rubricFields, {
        "recall.score": "5",
        "recall.evidenceQuote": "quote",
        "connections.score": "3",
        "connections.evidenceQuote": "quote",
        "application.score": "3",
        "application.evidenceQuote": "quote",
        "transfer.score": "3",
        "transfer.evidenceQuote": "quote",
      });
      expect(outOfRange.ok).toBe(false);
      if (!outOfRange.ok) {
        expect(outOfRange.error).toContain("recall.score");
        expect(outOfRange.error).toContain("4");
      }

      const validRubric = buildToolInput(rubricFields, {
        "recall.score": "3",
        "recall.evidenceQuote": "verbatim recall",
        "connections.score": "3",
        "connections.evidenceQuote": "verbatim connections",
        "application.score": "4",
        "application.evidenceQuote": "verbatim application",
        "transfer.score": "3",
        "transfer.evidenceQuote": "verbatim transfer",
      });
      expect(validRubric).toEqual({
        ok: true,
        input: {
          recall: { score: 3, evidenceQuote: "verbatim recall" },
          connections: { score: 3, evidenceQuote: "verbatim connections" },
          application: { score: 4, evidenceQuote: "verbatim application" },
          transfer: { score: 3, evidenceQuote: "verbatim transfer" },
        },
      });

      const debriefFields = schemaToFields(toolset.compose_debrief.inputSchema);
      const invalidJson = buildToolInput(debriefFields, {
        segments: "{not json",
      });
      expect(invalidJson.ok).toBe(false);
      if (!invalidJson.ok) {
        expect(invalidJson.error).toBe('invalid JSON for "segments"');
      }

      expect(
        buildToolInput(debriefFields, {
          segments: JSON.stringify([{ id: "s1" }]),
        }),
      ).toEqual({
        ok: true,
        input: { segments: [{ id: "s1" }] },
      });
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });
});

describe("textContent rendering path", () => {
  test("formatToolResult keeps script text as data, capText truncates, source has no raw HTML sinks", () => {
    const payload = {
      xss: "<script>alert(1)</script>",
      toolChangeHint: "Re-check this page's tools.",
    };
    const formatted = formatToolResult({
      content: [{ type: "text", text: JSON.stringify(payload) }],
    });
    expect(formatted.pretty).toContain("<script>alert(1)</script>");
    expect(formatted.hint).toBe("Re-check this page's tools.");

    expect(
      formatToolResult({
        content: [{ type: "text", text: "not-json{" }],
      }),
    ).toEqual({ pretty: "not-json{", hint: null });

    const long = "a".repeat(RESULT_OVER_CAP);
    const capped = capText(long);
    expect(capped.truncated).toBe(true);
    expect(capped.shown).toBe(long.slice(0, 2400));
    expect(capped.shown.length).toBe(2400);

    const source = readFileSync(
      `${import.meta.dir}/../components/ToolInspector.tsx`,
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("innerHTML");
  });
});

const RESULT_OVER_CAP = 2401;

describe("execution round-trip via the shared accessor", () => {
  test("two tools share the stack toolset instance with the live registry", async () => {
    const mockCtx = new MockModelContext();
    const stack = createMasteryStack(
      () => {},
      undefined,
      { document: { modelContext: mockCtx } } as never,
    );
    try {
      const toolset = stack.getToolset();
      const stateResponse = await toolset.get_learner_state.execute({});
      const state = parseToolPayload(stateResponse);
      expect(state.attemptCount).toBe(0);

      const noteResponse = await toolset.log_coaching_note.execute({
        note: "prefers concrete scenarios",
      });
      const note = parseToolPayload(noteResponse);
      expect(note.stored).toBe(true);

      expect(stack.registry).not.toBeNull();
      await stack.registry!.sync(BASE_LESSON);
      const viaRegistry = await mockCtx.callTool("get_learner_state", {});
      const parsed = parseToolPayload(viaRegistry);
      const notes = parsed.coachingNotes as Array<{ text: string }>;
      expect(notes.some((entry) => entry.text === "prefers concrete scenarios")).toBe(
        true,
      );
    } finally {
      stack.stopRuntimeDetection();
      stack.watcher?.stop();
    }
  });
});
