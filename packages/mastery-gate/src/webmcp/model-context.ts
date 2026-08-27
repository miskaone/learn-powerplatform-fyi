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
  /**
   * Real runtimes (ChatGPT's injected implementation, Chrome's origin trial)
   * return Promises from both methods — verified live 2026-08-27, where a
   * synchronous `getTools(): ToolDescriptor[]` contract let `.map` run on a
   * Promise and crashed /pl-400 on every poll tick. Both shapes are accepted;
   * consumers must `await Promise.resolve(...)`.
   */
  registerTool(
    tool: ToolDescriptor,
    options?: ToolRegistrationOptions,
  ): void | Promise<void>;
  getTools(): ToolDescriptor[] | Promise<ToolDescriptor[]>;
  addEventListener?(type: 'toolchange', listener: () => void): void;
  removeEventListener?(type: 'toolchange', listener: () => void): void;
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
 * Feature-detect document.modelContext first, falling back to
 * navigator.modelContext for backward compatibility. Returns null when
 * neither exists. host defaults to globalThis cast to ModelContextHost.
 */
export function resolveModelContext(
  host?: ModelContextHost,
): ModelContextLike | null {
  const resolved = host ?? (globalThis as ModelContextHost);
  const fromDocument = readModelContext(resolved.document);
  if (fromDocument !== null) {
    return fromDocument;
  }
  return readModelContext(resolved.navigator);
}

export function hasToolchangeEvents(mc: ModelContextLike): boolean {
  return typeof mc.addEventListener === 'function';
}

export function hasModelContext(host?: ModelContextHost): boolean {
  return resolveModelContext(host) !== null;
}

export function textResponse(payload: unknown): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}
