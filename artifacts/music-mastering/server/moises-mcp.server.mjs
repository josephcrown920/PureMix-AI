/** Server-only Moises MCP Streamable HTTP client. Keep endpoint URL private. */
const HOST = "mcp.moises.ai";
export function moisesEndpoint(env = process.env) {
  const raw = env.MOISES_MCP_URL;
  if (!raw) throw new Error("MOISES_MCP_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== HOST || !/^\/mcp\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash)
    throw new Error("Invalid Moises MCP endpoint");
  return url;
}
function parseReply(text, type) {
  if (type.includes("text/event-stream")) {
    const messages = text.split(/\r?\n\r?\n/);
    for (const message of messages.reverse()) {
      const data = message.split(/\r?\n/).filter(x => x.startsWith("data:")).map(x => x.slice(5).trim()).join("\n");
      if (data && data !== "[DONE]") { try { return JSON.parse(data); } catch {} }
    }
    throw new Error("Moises MCP returned no JSON event");
  }
  return JSON.parse(text);
}
export function createMoisesClient({ endpoint = moisesEndpoint(), fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  let sessionId;
  let sequence = 0;
  async function send(method, params = {}, notification = false) {
    const payload = { jsonrpc: "2.0", method, params };
    if (!notification) payload.id = ++sequence;
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    const response = await fetchImpl(endpoint.toString(), {
      method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Moises MCP request failed (HTTP ${response.status})`);
    sessionId = response.headers.get("mcp-session-id") || sessionId;
    if (notification || response.status === 202 || response.status === 204) return null;
    const reply = parseReply(await response.text(), response.headers.get("content-type") || "");
    if (reply.error) throw new Error(`Moises MCP error ${reply.error.code ?? ""}: ${reply.error.message ?? "unknown"}`);
    return reply.result;
  }
  async function initialize() {
    const result = await send("initialize", {
      protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "aurora-puremix", version: "1.0.0" },
    });
    await send("notifications/initialized", {}, true);
    return result;
  }
  async function listTools() {
    await initialize();
    const tools = [];
    let cursor;
    do {
      const result = await send("tools/list", cursor ? { cursor } : {});
      tools.push(...(result?.tools ?? []));
      cursor = result?.nextCursor;
      if (tools.length > 500) throw new Error("Moises MCP tool list too large");
    } while (cursor);
    return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  }
  async function callTool(name, args = {}, { approved = false } = {}) {
    if (!approved) throw new Error("Explicit approval required for remote Moises tool execution");
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new Error("Invalid MCP tool name");
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object");
    const tools = await listTools();
    if (!tools.some(tool => tool.name === name)) throw new Error("Tool not exposed by Moises MCP");
    return send("tools/call", { name, arguments: args });
  }
  return { initialize, listTools, callTool };
}
