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

  getTools(): ToolDescriptor[] {
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
