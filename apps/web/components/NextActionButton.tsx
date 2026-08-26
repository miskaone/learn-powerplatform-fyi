"use client";

import type { NextAction } from "@learn/mastery-gate/schema";

const ACTION_LABEL: Record<NextAction, string> = {
  hint: "Get a hint",
  review: "Review the lesson section",
  coach: "Work it through with the coach",
  go_deeper: "Go deeper on this concept",
  advance: "Advance to the next module",
};

export function NextActionButton(props: {
  action: NextAction;
  onActivate: (action: NextAction) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pl400-next-action">
      <button
        type="button"
        className="pl400-btn pl400-next-action-btn"
        disabled={props.disabled}
        onClick={() => props.onActivate(props.action)}
      >
        {ACTION_LABEL[props.action]}
      </button>
      <span className="pl400-verdict-line">engine verdict: {props.action}</span>
    </div>
  );
}
