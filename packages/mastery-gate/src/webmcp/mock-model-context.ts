import type {
  ModelContextLike,
  ToolDescriptor,
  ToolRegistrationOptions,
  ToolResponse,
} from './model-context';

/**
 * In-memory ModelContextLike with no toolchange events. addEventListener and
 * removeEventListener are intentionally absent so feature detection matches
 * hosts that only expose document.modelContext.
 */
export class EventlessMockModelContext implements ModelContextLike {
  protected readonly tools = new Map<string, ToolDescriptor>();

  registerTool(tool: ToolDescriptor, options?: ToolRegistrationOptions): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`duplicate tool: ${tool.name}`);
    }
    const signal = options?.signal;
    if (signal?.aborted) {
      return;
    }
    this.tools.set(tool.name, tool);
    if (signal !== undefined) {
      signal.addEventListener(
        'abort',
        () => {
          this.tools.delete(tool.name);
          this.onToolsChanged();
        },
        { once: true },
      );
    }
    this.onToolsChanged();
  }

  /**
   * Promise-returning, matching real runtimes (ChatGPT injected, Chrome
   * origin trial). Tests must await — a sync mock here previously let the
   * un-awaited `.map`-on-a-Promise crash reach production unseen.
   */
  getTools(): Promise<ToolDescriptor[]> {
    return Promise.resolve([...this.tools.values()]);
  }

  /** Synchronous escape hatch for test assertions. */
  getToolsSync(): ToolDescriptor[] {
    return [...this.tools.values()];
  }

  getToolNames(): string[] {
    return [...this.tools.keys()];
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  callTool(name: string, input: unknown): Promise<ToolResponse> {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      throw new Error(`unknown tool: ${name}`);
    }
    return tool.execute(input);
  }

  /**
   * Spec form (webmachinelearning.github.io/webmcp, draft 2026-08-26):
   * executeTool(RegisteredTool, inputJsonString) resolves a stringified
   * result — Chrome 152 enforces this strictly, rejecting any non-
   * RegisteredTool first argument with a TypeError. The mock mirrors that
   * strictness so tests exercise the real signature.
   */
  executeTool(tool: ToolDescriptor, inputJson: string): Promise<string>;
  /**
   * @deprecated Legacy pre-spec form (nameString, argsObject) — kept only
   * for back-compat with callers written before the 2026-08-26 draft. New
   * code must pass the RegisteredTool object and a JSON string.
   */
  executeTool(name: string, input: unknown): Promise<ToolResponse>;
  async executeTool(
    toolOrName: ToolDescriptor | string,
    input: unknown,
  ): Promise<string | ToolResponse> {
    if (typeof toolOrName === 'string') {
      // Deprecated legacy path — see overload note above.
      const tool = this.tools.get(toolOrName);
      if (tool === undefined) {
        throw new Error(`unknown tool: ${toolOrName}`);
      }
      return tool.execute(input);
    }
    const registered =
      toolOrName !== null &&
      typeof toolOrName === 'object' &&
      typeof toolOrName.name === 'string'
        ? this.tools.get(toolOrName.name)
        : undefined;
    if (registered === undefined) {
      // Chrome 152's exact rejection message, observed live 2026-08-29.
      throw new TypeError("The provided value is not of type 'RegisteredTool'");
    }
    if (typeof input !== 'string') {
      throw new TypeError('executeTool input must be a JSON-encoded string');
    }
    const parsed: unknown = input.length === 0 ? {} : JSON.parse(input);
    const result = await registered.execute(parsed);
    return JSON.stringify(result);
  }

  protected onToolsChanged(): void {}
}

export class MockModelContext extends EventlessMockModelContext {
  private readonly listeners = new Set<() => void>();
  private changeCount = 0;

  public get toolchangeCount(): number {
    return this.changeCount;
  }

  addEventListener(type: 'toolchange', listener: () => void): void {
    void type;
    this.listeners.add(listener);
  }

  removeEventListener(type: 'toolchange', listener: () => void): void {
    void type;
    this.listeners.delete(listener);
  }

  protected override onToolsChanged(): void {
    this.changeCount += 1;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
