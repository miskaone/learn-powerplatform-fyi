export interface ToolResponseContent {
  type: 'text';
  text: string;
}

export interface ToolResponse {
  content: ToolResponseContent[];
}

export type JsonSchema = Record<string, unknown>;

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: unknown) => Promise<ToolResponse>;
}

export interface ToolRegistrationOptions {
  signal?: AbortSignal;
}

export interface ModelContextLike {
  registerTool(tool: ToolDescriptor, options?: ToolRegistrationOptions): void;
  getTools(): ToolDescriptor[];
  addEventListener(type: 'toolchange', listener: () => void): void;
  removeEventListener(type: 'toolchange', listener: () => void): void;
}

export interface ModelContextHost {
  navigator?: unknown;
  document?: unknown;
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readModelContext(carrier: unknown): ModelContextLike | null {
  if (!isNonNullObject(carrier)) {
    return null;
  }
  const modelContext = carrier['modelContext'];
  if (!isNonNullObject(modelContext)) {
    return null;
  }
  return modelContext as unknown as ModelContextLike;
}

/**
 * Feature-detect navigator.modelContext (preferred) vs document.modelContext.
 * Returns null when neither exists. host defaults to globalThis cast to ModelContextHost.
 */
export function resolveModelContext(
  host?: ModelContextHost,
): ModelContextLike | null {
  const resolved = host ?? (globalThis as ModelContextHost);
  const fromNavigator = readModelContext(resolved.navigator);
  if (fromNavigator !== null) {
    return fromNavigator;
  }
  return readModelContext(resolved.document);
}

export function hasModelContext(host?: ModelContextHost): boolean {
  return resolveModelContext(host) !== null;
}

export function textResponse(payload: unknown): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}
