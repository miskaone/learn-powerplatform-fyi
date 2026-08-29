// Browser-free integration test for injected.js: evaluates the MAIN-world
// script against stubbed document/navigator/window and drives it through
// postMessage events — the fallback modelContext polyfill, the relay guards,
// and both callTool paths, all without a browser.
import { describe, expect, test } from 'bun:test';

const source = await Bun.file(new URL('./injected.js', import.meta.url).pathname).text();

function makeHarness({ existingModelContext } = {}) {
  const posted = [];
  const messageListeners = [];
  const windowStub = {
    location: { origin: 'https://learn.powerplatform.fyi' },
    addEventListener(type, fn) {
      if (type === 'message') messageListeners.push(fn);
    },
    postMessage(data, origin) {
      posted.push({ data, origin });
    },
  };
  const documentStub = {};
  if (existingModelContext) documentStub.modelContext = existingModelContext;
  const navigatorStub = {};
  // injected.js is plain script (not a module) — evaluate with stubs bound.
  new Function('document', 'navigator', 'window', source)(documentStub, navigatorStub, windowStub);
  const dispatch = (data, overrides = {}) => {
    for (const fn of messageListeners) {
      fn({
        source: overrides.source ?? windowStub,
        origin: overrides.origin ?? windowStub.location.origin,
        data,
      });
    }
  };
  const nextPosted = async (predicate = () => true) => {
    for (let i = 0; i < 50; i += 1) {
      const hit = posted.find((p) => predicate(p));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('no matching postMessage observed');
  };
  return { windowStub, documentStub, posted, dispatch, nextPosted };
}

describe('fallback modelContext polyfill', () => {
  test('installs when no runtime exists', () => {
    const h = makeHarness();
    const mc = h.documentStub.modelContext;
    expect(mc).toBeDefined();
    expect(typeof mc.registerTool).toBe('function');
    expect(typeof mc.getTools).toBe('function');
    expect(typeof mc.executeTool).toBe('function');
    expect(mc.__webmcpBridgeFallback).toBe(true);
  });

  test('never overwrites an existing runtime', () => {
    const existing = { getTools: async () => [], marker: 'real-runtime' };
    const h = makeHarness({ existingModelContext: existing });
    expect(h.documentStub.modelContext).toBe(existing);
  });

  test('registerTool / getTools / executeTool round trip, duplicate throws', async () => {
    const h = makeHarness();
    const mc = h.documentStub.modelContext;
    await mc.registerTool({
      name: 'echo',
      description: 'd',
      inputSchema: { type: 'object' },
      execute: async (input) => ({ content: [{ type: 'text', text: JSON.stringify(input) }] }),
    });
    const tools = await mc.getTools();
    expect(tools.map((t) => t.name)).toEqual(['echo']);
    const res = await mc.executeTool('echo', { a: 1 });
    expect(res.content[0].text).toBe('{"a":1}');
    await expect(mc.registerTool({ name: 'echo', execute: async () => ({ content: [] }) })).rejects.toThrow(
      'duplicate tool: echo',
    );
    await expect(mc.executeTool('nope', {})).rejects.toThrow('unknown tool: nope');
  });

  test('abort signal deregisters and fires toolchange', async () => {
    const h = makeHarness();
    const mc = h.documentStub.modelContext;
    let changes = 0;
    mc.addEventListener('toolchange', () => {
      changes += 1;
    });
    const controller = new AbortController();
    await mc.registerTool(
      { name: 't', description: '', inputSchema: {}, execute: async () => ({ content: [] }) },
      { signal: controller.signal },
    );
    expect(changes).toBe(1);
    controller.abort();
    expect(changes).toBe(2);
    expect(await mc.getTools()).toEqual([]);
  });
});

describe('relay message handling', () => {
  test('listTools request answered with mapped descriptors', async () => {
    const h = makeHarness();
    await h.documentStub.modelContext.registerTool({
      name: 'get_current_question',
      description: 'q',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ content: [] }),
    });
    h.dispatch({ source: 'webmcp-bridge:to-page', id: 'r1', op: 'listTools' });
    const reply = await h.nextPosted((p) => p.data.id === 'r1');
    expect(reply.origin).toBe('https://learn.powerplatform.fyi');
    expect(reply.data.source).toBe('webmcp-bridge:from-page');
    expect(reply.data.ok).toBe(true);
    expect(reply.data.result).toEqual([
      { name: 'get_current_question', description: 'q', inputSchema: { type: 'object', properties: {} } },
    ]);
  });

  test('callTool passes args and returns content verbatim', async () => {
    const h = makeHarness();
    let seen = null;
    await h.documentStub.modelContext.registerTool({
      name: 'submit_answer',
      description: '',
      inputSchema: {},
      execute: async (input) => {
        seen = input;
        return { content: [{ type: 'text', text: 'VERDICT', nested: { deep: [1, 2] } }] };
      },
    });
    h.dispatch({ source: 'webmcp-bridge:to-page', id: 'r2', op: 'callTool', name: 'submit_answer', args: { answer: 'B' } });
    const reply = await h.nextPosted((p) => p.data.id === 'r2');
    expect(seen).toEqual({ answer: 'B' });
    expect(reply.data.ok).toBe(true);
    expect(reply.data.result.content).toEqual([{ type: 'text', text: 'VERDICT', nested: { deep: [1, 2] } }]);
  });

  test('tool errors surface as ok:false with message', async () => {
    const h = makeHarness();
    await h.documentStub.modelContext.registerTool({
      name: 'boom',
      description: '',
      inputSchema: {},
      execute: async () => {
        throw new Error('kaput');
      },
    });
    h.dispatch({ source: 'webmcp-bridge:to-page', id: 'r3', op: 'callTool', name: 'boom', args: {} });
    const reply = await h.nextPosted((p) => p.data.id === 'r3');
    expect(reply.data.ok).toBe(false);
    expect(reply.data.error).toContain('kaput');
  });

  test('wrong origin and wrong source are ignored', async () => {
    const h = makeHarness();
    h.dispatch({ source: 'webmcp-bridge:to-page', id: 'x1', op: 'listTools' }, { origin: 'https://evil.example' });
    h.dispatch({ source: 'webmcp-bridge:to-page', id: 'x2', op: 'listTools' }, { source: { not: 'window' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(h.posted.filter((p) => p.data.id === 'x1' || p.data.id === 'x2')).toEqual([]);
  });

  test('toolchange from the page is relayed to the content script', async () => {
    const h = makeHarness();
    // bindToolchange happens at load; registering a tool fires the polyfill's
    // toolchange, which injected.js forwards as a from-page notice.
    await h.documentStub.modelContext.registerTool({
      name: 'n',
      description: '',
      inputSchema: {},
      execute: async () => ({ content: [] }),
    });
    const note = await h.nextPosted((p) => p.data.kind === 'toolchange');
    expect(note.data.source).toBe('webmcp-bridge:from-page');
  });
});
