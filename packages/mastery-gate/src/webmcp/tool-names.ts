export const STATIC_TOOL_NAMES = [
  'get_learner_state',
  'get_current_context',
  'navigate_to_anchor',
  'log_coaching_note',
  'get_current_question',
  'submit_answer',
  'get_hint',
  'request_next_action',
  'prescribe_drill',
  'score_rubric',
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
