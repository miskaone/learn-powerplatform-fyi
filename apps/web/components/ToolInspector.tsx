"use client";

import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
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
}): JSX.Element {
  const { field, descriptorName, values, onChange } = props;
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
          />
        ))}
      </fieldset>
    );
  }

  const id = `ti-${descriptorName}-${field.path.join("-")}`;
  const key = field.path.join(".");
  const value = values[key] ?? "";
  const required = field.required || undefined;

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

  const setNewResult = (next: FormattedToolResult) => {
    setExpanded(false);
    setResult(next);
  };

  const invoke = async () => {
    const built = buildToolInput(fields, values);
    if (!built.ok) {
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
      {result !== null && capped !== null ? (
        <>
          {result.hint !== null ? (
            <p className="tool-inspector-hint">{result.hint}</p>
          ) : null}
          <pre className="tool-inspector-result">
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

  const toolset = props.gate.stack.getToolset();
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
          Every tool below is exactly what a visiting agent sees — same schemas,
          same guards, same redaction. Invoke anything.
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
