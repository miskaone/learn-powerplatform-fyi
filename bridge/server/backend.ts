import type { McpBackend } from './mcp';
import type { WebMcpToolDescriptor } from './protocol';
import type { BridgeWsServer } from './ws';

const BRIDGE_STATUS_TOOL: WebMcpToolDescriptor = {
  name: 'bridge_status',
  description:
    'WebMCP bridge status. No browser tab is currently paired — open https://learn.powerplatform.fyi, click the WebMCP Bridge extension icon, paste the pairing token, and arm the tab. Call this tool for current status.',
  inputSchema: { type: 'object', properties: {} },
};

async function statusText(ws: BridgeWsServer): Promise<string> {
  const connected = ws.isConnected ? 'yes' : 'no';
  const paired = ws.isPaired ? 'yes' : 'no';
  const tab = ws.pairedTabUrl ?? 'none';
  let tools = 'n/a';
  if (!ws.isConnected || !ws.isPaired) {
    tools = '1 (bridge_status)';
  } else {
    try {
      const list = await ws.listTools();
      tools = String(list.length);
    } catch {
      tools = 'n/a';
    }
  }
  return `connected: ${connected}\npaired: ${paired}\ntab: ${tab}\ntools: ${tools}`;
}

export function createBridgeBackend(ws: BridgeWsServer, log: (msg: string) => void): McpBackend {
  return {
    async listTools() {
      if (!ws.isConnected || !ws.isPaired) {
        const why = !ws.isConnected ? 'no extension connected' : 'no tab paired';
        log(`listTools: ${why}; offering bridge_status`);
        return { tools: [BRIDGE_STATUS_TOOL] };
      }
      // Re-query live on every call — never cache. Names are unprefixed.
      const tools = await ws.listTools();
      return { tools };
    },
    async callTool(name, args) {
      if (name === 'bridge_status') {
        const text = await statusText(ws);
        return { content: [{ type: 'text', text }] };
      }
      if (!ws.isPaired) {
        return {
          content: [
            {
              type: 'text',
              text: 'No tab paired. Open https://learn.powerplatform.fyi, click the WebMCP Bridge extension icon, paste the pairing token, and arm the tab.',
            },
          ],
          isError: true,
        };
      }
      return ws.callTool(name, args);
    },
  };
}
