import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TIMEOUT_MS = 8000;

export async function queryMcpServer(config) {
  const isStdio = config.command && (!config.type || config.type === 'stdio');
  const isRemote = config.url || config.type === 'sse' || config.type === 'http' || config.type === 'streamable-http';
  if (isStdio) return queryStdio(config);
  if (isRemote) return { tools: [], resources: [], prompts: [], isRemote: true };
  return { error: 'Unknown transport type' };
}

async function queryStdio(config) {
  let timer;
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args || [],
    env: { ...process.env, ...(config.env || {}) },
    stderr: 'pipe', // prevent subprocess stderr from polluting the TUI
  });

  const client = new Client(
    { name: 'mcp-manager', version: '1.0.0' },
    { capabilities: {} }
  );

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      transport.close().catch(() => {});
      reject(new Error('Connection timed out (8s)'));
    }, TIMEOUT_MS);
  });

  const operation = (async () => {
    await client.connect(transport);
    const [t, r, p] = await Promise.allSettled([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ]);
    return {
      tools: t.status === 'fulfilled' ? (t.value.tools || []) : [],
      resources: r.status === 'fulfilled' ? (r.value.resources || []) : [],
      prompts: p.status === 'fulfilled' ? (p.value.prompts || []) : [],
    };
  })();
  operation.catch(() => {}); // suppress unhandled rejection if timeout wins

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
    try { await client.close(); } catch {}
  }
}
