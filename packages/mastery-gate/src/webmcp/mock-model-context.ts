import type {
  ModelContextLike,
  ToolDescriptor,
  ToolRegistrationOptions,
  ToolResponse,
} from './model-context';

export class MockModelContext implements ModelContextLike {
  private readonly tools = new Map<string, ToolDescriptor>();
  private readonly listeners = new Set<() => void>();
  private changeCount = 0;

  public get toolchangeCount(): number {
    return this.changeCount;
  }

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
          this.dispatchToolChange();
        },
        { once: true },
      );
    }
    this.dispatchToolChange();
  }

  getTools(): ToolDescriptor[] {
    return [...this.tools.values()];
  }

  addEventListener(type: 'toolchange', listener: () => void): void {
    void type;
    this.listeners.add(listener);
  }

  removeEventListener(type: 'toolchange', listener: () => void): void {
    void type;
    this.listeners.delete(listener);
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

  private dispatchToolChange(): void {
    this.changeCount += 1;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
