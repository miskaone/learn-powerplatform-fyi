"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type JSX,
} from "react";
import type { ToolDescriptor, ToolName } from "@learn/mastery-gate/webmcp";
import {
  buildToolInput,
  capText,
  formatToolResult,
  schemaToFields,
  type FormattedToolResult,
  type InspectorField,
} from "../lib/inspectorSchema";
import type { MasteryGateView } from "./useMasteryGate";

export function useInspectorVisibility(): {
  visible: boolean;
  toggle: () => void;
} {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (new URLSearchParams(window.location.search).get("inspector") === "1") {
        setVisible(true);
      }
    } catch {
      // Static-export/prerender safe: ignore malformed search strings.
    }
  }, []);

  return {
    visible,
    toggle: () => {
      setVisible((current) => !current);
    },
  };
}

function requiredMark(required: boolean): JSX.Element | null {
  return required ? (
    <span className="tool-inspector-req" aria-hidden="true">
      {" "}
      *
    </span>
  ) : null;
}

function FieldControl(props: {
  field: InspectorField;
  descriptorName: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  invalidKey: string | null;
  errorId: string;
}): JSX.Element {
  const { field, descriptorName, values, onChange, invalidKey, errorId } =
    props;
  if (field.kind === "group") {
    return (
      <fieldset className="tool-inspector-group">
        <legend>
          {field.name}
          {requiredMark(field.required)}
        </legend>
        {field.children.map((child) => (
          <FieldControl
            key={child.path.join(".")}
            field={child}
            descriptorName={descriptorName}
            values={values}
            onChange={onChange}
            invalidKey={invalidKey}
            errorId={errorId}
          />
        ))}
      </fieldset>
    );
  }

  const id = `ti-${descriptorName}-${field.path.join("-")}`;
  const key = field.path.join(".");
  const value = values[key] ?? "";
  const required = field.required || undefined;
  // The offending control is tied to the announced validation message
  // (cross-review finding 7): aria-invalid flags it, aria-describedby
  // points at the live status element carrying the error text.
  const invalid = key === invalidKey || undefined;
  const describedBy = invalid ? errorId : undefined;

  return (
    <div>
      <label htmlFor={id}>
        {field.name}
        {requiredMark(field.required)}
      </label>
      {field.kind === "string" ? (
        <input
          id={id}
          type="text"
          value={value}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => {
            onChange(key, event.target.value);
          }}
        />
      ) : null}
      {field.kind === "number" ? (
        <input
          id={id}
          type="number"
          value={value}
          step="any"
          min={field.minimum ?? undefined}
          max={field.maximum ?? undefined}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => {
            onChange(key, event.target.value);
          }}
        />
      ) : null}
      {field.kind === "enum" ? (
        <select
          id={id}
          value={value}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => {
            onChange(key, event.target.value);
          }}
        >
          <option value="">—</option>
          {field.values.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      ) : null}
      {field.kind === "json" ? (
        <textarea
          id={id}
          rows={3}
          placeholder="JSON"
          value={value}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => {
            onChange(key, event.target.value);
          }}
        />
      ) : null}
    </div>
  );
}

function ToolInvoker(props: {
  descriptor: ToolDescriptor;
  onInvoked: () => void;
}): JSX.Element {
  const { descriptor } = props;
  const fields = useMemo(
    () => schemaToFields(descriptor.inputSchema),
    [descriptor],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FormattedToolResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [invalid, setInvalid] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const resultRef = useRef<HTMLPreElement>(null);

  const statusId = `ti-${descriptor.name}-status`;

  const setNewResult = (next: FormattedToolResult) => {
    setExpanded(false);
    setResult(next);
  };

  // "Show full response" unmounts itself when clicked; without this the
  // keyboard focus would fall back to <body> (cross-review finding 6).
  // The expanded <pre> takes focus instead (tabIndex={-1} below).
  useEffect(() => {
    if (expanded) {
      resultRef.current?.focus();
    }
  }, [expanded]);

  const invoke = async () => {
    const built = buildToolInput(fields, values);
    if (!built.ok) {
      setInvalid({ key: built.path.join("."), message: built.error });
      setNewResult({
        pretty: JSON.stringify(
          { error: "invalid_input", detail: built.error },
          null,
          2,
        ),
        hint: null,
      });
      return;
    }
    setInvalid(null);
    setRunning(true);
    try {
      const response = await descriptor.execute(built.input);
      setNewResult(formatToolResult(response));
    } catch (error) {
      setNewResult({
        pretty: JSON.stringify({ error: String(error) }, null, 2),
        hint: null,
      });
    } finally {
      setRunning(false);
      props.onInvoked();
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void invoke();
  };

  const capped = result === null ? null : capText(result.pretty);

  // Announced via the always-mounted live region below (finding 7):
  // validation errors verbatim; successful results announce the hint when
  // one exists, otherwise a short truthful summary — never the JSON dump.
  const statusText =
    invalid !== null
      ? invalid.message
      : result === null
        ? ""
        : (result.hint ??
          `Response received (${result.pretty.length.toLocaleString()} characters).`);

  return (
    <details className="tool-inspector-tool">
      <summary>
        <code>{descriptor.name}</code>
      </summary>
      <p className="tool-inspector-desc muted">{descriptor.description}</p>
      <form onSubmit={onSubmit}>
        {fields.map((field) => (
          <FieldControl
            key={field.path.join(".")}
            field={field}
            descriptorName={descriptor.name}
            values={values}
            onChange={(key, value) => {
              setValues((current) => ({ ...current, [key]: value }));
            }}
            invalidKey={invalid?.key ?? null}
            errorId={statusId}
          />
        ))}
        <button
          type="submit"
          className="tool-inspector-invoke"
          disabled={running}
        >
          {running ? "Invoking…" : "Invoke"}
        </button>
      </form>
      <p
        id={statusId}
        role="status"
        className={
          result !== null && result.hint !== null && invalid === null
            ? "tool-inspector-hint"
            : "tool-inspector-status"
        }
      >
        {statusText}
      </p>
      {result !== null && capped !== null ? (
        <>
          <pre
            className="tool-inspector-result"
            tabIndex={-1}
            ref={resultRef}
          >
            <code>{expanded ? result.pretty : capped.shown}</code>
          </pre>
          {capped.truncated && !expanded ? (
            <button
              type="button"
              className="tool-inspector-expand"
              onClick={() => {
                setExpanded(true);
              }}
            >
              Show full response ({result.pretty.length.toLocaleString()} chars)
            </button>
          ) : null}
        </>
      ) : null}
    </details>
  );
}

export function ToolInspectorPanel(props: {
  gate: MasteryGateView;
  visible: boolean;
}): JSX.Element | null {
  if (!props.visible || props.gate.stack == null) {
    return null;
  }

  // Invocation goes through the registry-wrapped descriptors whenever an
  // agent runtime is bound — the exact guard layer agents pass through
  // (cross-review finding 1). Agent-less, these are the raw descriptors and
  // the engine-guard invariant (see MasteryStack.getToolset) is the guard.
  const toolset = props.gate.stack.getInvocableToolset();
  const descriptors: ToolDescriptor[] = [];
  for (const name of props.gate.rosterNames) {
    if (!Object.prototype.hasOwnProperty.call(toolset, name)) {
      continue;
    }
    descriptors.push(toolset[name as ToolName]);
  }
  const n = descriptors.length;

  return (
    <section
      className="pl400-card tool-inspector"
      aria-labelledby="tool-inspector-heading"
    >
      <details className="tool-inspector-details" open>
        <summary id="tool-inspector-heading">
          Tool Inspector — {n} {n === 1 ? "tool" : "tools"} live
        </summary>
        <p className="tool-inspector-framing">
          {props.gate.agentDetected
            ? "Every tool below is the same registered descriptor a visiting agent invokes — same schemas, same guard layer, same redaction. Invoke anything."
            : "No agent runtime is attached — these are the exact descriptors one would register: same schemas, same redaction, with exam-time rules enforced inside the engine itself. Invoke anything."}
        </p>
        {descriptors.map((descriptor) => (
          <ToolInvoker
            key={descriptor.name}
            descriptor={descriptor}
            onInvoked={() => {
              props.gate.refresh();
            }}
          />
        ))}
      </details>
    </section>
  );
}
