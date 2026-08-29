import type { JsonSchema } from "@learn/mastery-gate/webmcp";

export type InspectorField =
  | { kind: "string"; name: string; path: string[]; required: boolean }
  | {
      kind: "number";
      name: string;
      path: string[];
      required: boolean;
      minimum: number | null;
      maximum: number | null;
    }
  | {
      kind: "enum";
      name: string;
      path: string[];
      required: boolean;
      values: string[];
    }
  | {
      kind: "group";
      name: string;
      path: string[];
      required: boolean;
      children: InspectorField[];
    }
  | { kind: "json"; name: string; path: string[]; required: boolean };

export type BuildInputResult =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; error: string };

export interface FormattedToolResult {
  pretty: string;
  hint: string | null;
}

export const RESULT_DISPLAY_CAP = 2400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringEnumValues(schema: JsonSchema): string[] | null {
  const values = schema["enum"];
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  if (!values.every((entry): entry is string => typeof entry === "string")) {
    return null;
  }
  return values;
}

function requiredNames(schema: JsonSchema): Set<string> {
  const required = schema["required"];
  if (!Array.isArray(required)) {
    return new Set();
  }
  return new Set(
    required.filter((entry): entry is string => typeof entry === "string"),
  );
}

function propertyRecord(schema: JsonSchema): Record<string, JsonSchema> {
  const properties = schema["properties"];
  if (!isRecord(properties)) {
    return {};
  }
  const record: Record<string, JsonSchema> = {};
  for (const name of Object.keys(properties)) {
    const value = properties[name];
    record[name] = isRecord(value) ? value : {};
  }
  return record;
}

function propertyToField(
  name: string,
  schema: JsonSchema,
  path: string[],
  required: boolean,
  depth: number,
): InspectorField {
  const enumValues = stringEnumValues(schema);
  if (enumValues !== null) {
    return { kind: "enum", name, path, required, values: enumValues };
  }
  const type = schema["type"];
  if (type === "string") {
    return { kind: "string", name, path, required };
  }
  if (type === "number") {
    return {
      kind: "number",
      name,
      path,
      required,
      minimum: typeof schema["minimum"] === "number" ? schema["minimum"] : null,
      maximum: typeof schema["maximum"] === "number" ? schema["maximum"] : null,
    };
  }
  if (type === "object" && depth === 0) {
    return {
      kind: "group",
      name,
      path,
      required,
      children: objectPropertiesToFields(schema, path, depth + 1),
    };
  }
  return { kind: "json", name, path, required };
}

function objectPropertiesToFields(
  schema: JsonSchema,
  parentPath: string[],
  depth: number,
): InspectorField[] {
  const properties = propertyRecord(schema);
  const required = requiredNames(schema);
  const fields: InspectorField[] = [];
  for (const name of Object.keys(properties)) {
    const property = properties[name] ?? {};
    fields.push(
      propertyToField(
        name,
        property,
        [...parentPath, name],
        required.has(name),
        depth,
      ),
    );
  }
  return fields;
}

export function schemaToFields(schema: JsonSchema): InspectorField[] {
  const objectSchema = isRecord(schema) ? schema : {};
  return objectPropertiesToFields(objectSchema, [], 0);
}

function dottedPath(path: string[]): string {
  return path.join(".");
}

function isEmptyValue(value: string | undefined): boolean {
  return value === undefined || value === "";
}

function allChildrenEmpty(
  fields: InspectorField[],
  values: Record<string, string>,
): boolean {
  return fields.every((field) => {
    if (field.kind === "group") {
      return allChildrenEmpty(field.children, values);
    }
    return isEmptyValue(values[dottedPath(field.path)]);
  });
}

type FieldBuild =
  | { ok: true; present: boolean; value?: unknown }
  | { ok: false; error: string };

function buildField(
  field: InspectorField,
  values: Record<string, string>,
): FieldBuild {
  const dotted = dottedPath(field.path);
  switch (field.kind) {
    case "string":
    case "enum": {
      const raw = values[dotted];
      if (isEmptyValue(raw)) {
        if (field.required) {
          return { ok: false, error: `missing required field "${dotted}"` };
        }
        return { ok: true, present: false };
      }
      if (field.kind === "enum" && !field.values.includes(raw)) {
        return { ok: false, error: `invalid value for "${dotted}"` };
      }
      return { ok: true, present: true, value: raw };
    }
    case "number": {
      const raw = values[dotted];
      if (isEmptyValue(raw)) {
        if (field.required) {
          return { ok: false, error: `missing required field "${dotted}"` };
        }
        return { ok: true, present: false };
      }
      const num = Number(raw);
      if (Number.isNaN(num)) {
        return { ok: false, error: `invalid number for "${dotted}"` };
      }
      if (field.minimum !== null && num < field.minimum) {
        return {
          ok: false,
          error: `"${dotted}" is below minimum ${field.minimum}`,
        };
      }
      if (field.maximum !== null && num > field.maximum) {
        return {
          ok: false,
          error: `"${dotted}" is above maximum ${field.maximum}`,
        };
      }
      return { ok: true, present: true, value: num };
    }
    case "json": {
      const raw = values[dotted];
      if (isEmptyValue(raw)) {
        if (field.required) {
          return { ok: false, error: `missing required field "${dotted}"` };
        }
        return { ok: true, present: false };
      }
      try {
        return { ok: true, present: true, value: JSON.parse(raw) as unknown };
      } catch {
        return { ok: false, error: `invalid JSON for "${dotted}"` };
      }
    }
    case "group": {
      if (!field.required && allChildrenEmpty(field.children, values)) {
        return { ok: true, present: false };
      }
      const nested = buildObject(field.children, values);
      if (!nested.ok) {
        return nested;
      }
      return { ok: true, present: true, value: nested.input };
    }
  }
}

function buildObject(
  fields: InspectorField[],
  values: Record<string, string>,
): BuildInputResult {
  const input: Record<string, unknown> = {};
  for (const field of fields) {
    const result = buildField(field, values);
    if (!result.ok) {
      return result;
    }
    if (result.present) {
      input[field.name] = result.value;
    }
  }
  return { ok: true, input };
}

export function buildToolInput(
  fields: InspectorField[],
  values: Record<string, string>,
): BuildInputResult {
  return buildObject(fields, values);
}

function isTextToolResponse(
  response: unknown,
): response is { content: Array<{ type: "text"; text: string }> } {
  if (!isRecord(response) || !Array.isArray(response["content"])) {
    return false;
  }
  const first = response["content"][0];
  return (
    isRecord(first) &&
    first["type"] === "text" &&
    typeof first["text"] === "string"
  );
}

export function formatToolResult(response: unknown): FormattedToolResult {
  try {
    if (isTextToolResponse(response)) {
      const text = response.content[0]?.text ?? "";
      try {
        const parsed: unknown = JSON.parse(text);
        const hint =
          typeof (parsed as { toolChangeHint?: unknown } | null)
            ?.toolChangeHint === "string"
            ? (parsed as { toolChangeHint: string }).toolChangeHint
            : null;
        return { pretty: JSON.stringify(parsed, null, 2), hint };
      } catch {
        return { pretty: text, hint: null };
      }
    }
    const pretty = JSON.stringify(response, null, 2);
    return { pretty: pretty ?? String(response), hint: null };
  } catch {
    return { pretty: String(response), hint: null };
  }
}

export function capText(
  text: string,
  cap: number = RESULT_DISPLAY_CAP,
): { shown: string; truncated: boolean } {
  if (text.length > cap) {
    return { shown: text.slice(0, cap), truncated: true };
  }
  return { shown: text, truncated: false };
}
