export const STATIC_TOOL_NAMES = [
  'get_learner_state',
  'get_current_context',
  'get_lesson_brief',
  'navigate_to_anchor',
  'log_coaching_note',
  'get_current_question',
  'submit_answer',
  'get_hint',
  'request_next_action',
  'prescribe_drill',
  'score_rubric',
  'set_lesson_aim',
] as const;

export const DYNAMIC_TOOL_NAMES = [
  'advance_module',
  'get_misconception_brief',
  'mutate_assumption',
  'commit_prediction',
  'reveal_outcome',
  'start_exam',
  'get_exam_status',
  'submit_exam',
  'get_exam_debrief',
  'compose_debrief',
  'get_narration_script',
  'advance_segment',
] as const;

export type StaticToolName = (typeof STATIC_TOOL_NAMES)[number];
export type DynamicToolName = (typeof DYNAMIC_TOOL_NAMES)[number];
export type ToolName = StaticToolName | DynamicToolName;

export const EXAM_TOOL_NAMES: readonly ToolName[] = [
  'start_exam',
  'get_exam_status',
  'submit_exam',
  'get_exam_debrief',
];

export const ALL_TOOL_NAMES: readonly ToolName[] = [
  ...STATIC_TOOL_NAMES,
  ...DYNAMIC_TOOL_NAMES,
];

const TOOL_ORDER_INDEX: ReadonlyMap<string, number> = new Map(
  ALL_TOOL_NAMES.map((name, index) => [name, index]),
);

/**
 * Canonical Tool Roster ordering: ALL_TOOL_NAMES declaration order for known
 * tools, then any unknown (non-mastery) tool names alphabetically after.
 * Every surface that lists tools (registry.getRegisteredNames, the
 * ToolSurfaceWatcher's getTools() polling) must order through this one
 * function so the on-page roster never reshuffles between a sync-driven
 * update and the next poll tick.
 */
export function canonicalToolOrder(names: readonly string[]): string[] {
  return [...names].sort((a, b) => {
    const ai = TOOL_ORDER_INDEX.get(a);
    const bi = TOOL_ORDER_INDEX.get(b);
    if (ai !== undefined && bi !== undefined) {
      return ai - bi;
    }
    if (ai !== undefined) {
      return -1;
    }
    if (bi !== undefined) {
      return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
