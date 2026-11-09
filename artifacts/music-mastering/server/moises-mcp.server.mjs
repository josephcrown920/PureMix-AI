/** Secure server-side MCP client. Do not import from client components. */
const HOST = "mcp.moises.ai";
export function moisesEndpoint(env = typeof process === "undefined" ? {} : process.env) {
  const raw = env.MOISES_MCP_URL;
  if (!raw) throw new Error("MOISES_MCP_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== HOST || !/^\/mcp\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash || url.username || url.password)
    throw new Error("Invalid Moises MCP endpoint");
  return url;
}
function parseReply(text, type, id) {
  const candidates = type.includes("text/event-stream")
    ? text.split(/\r?\n\r?\n/).map(chunk => chunk.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n")).filter(Boolean)
    : [text];
  for (const raw of candidates) {
    if (raw === "[DONE]") continue;
    let item;
    try { item = JSON.parse(raw); } catch { continue; }
    if (item.id === id && (Object.hasOwn(item, "result") || item.error)) return item;
  }
  throw new Error("Moises MCP did not return the matching JSON-RPC response");
}
export function createMoisesClient({ endpoint = moisesEndpoint(), fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  if (!(endpoint instanceof URL) || endpoint.protocol !== "https:" || endpoint.hostname !== HOST) throw new Error("Untrusted MCP endpoint");
  let sessionId;
  let sequence = 0;
  let ready = false;
  async function send(method, params = {}, notification = false) {
    const id = notification ? undefined : ++sequence;
    const payload = { jsonrpc: "2.0", method, params, ...(notification ? {} : { id }) };
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-03-26" };
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    const response = await fetchImpl(endpoint.toString(), {
      method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs), redirect: "error",
    });
    if (!response.ok) throw new Error(`Moises MCP HTTP ${response.status}`);
    const newSession = response.headers.get("mcp-session-id");
    if (newSession) sessionId = newSession;
    if (notification) return null;
    if (response.status === 202 || response.status === 204) throw new Error("Moises MCP returned no result for a request");
    const body = await response.text();
    if (body.length > 4_000_000) throw new Error("Moises MCP response too large");
    const reply = parseReply(body, response.headers.get("content-type") || "", id);
    if (reply.error) throw new Error(`Moises MCP error ${reply.error.code ?? ""}: ${String(reply.error.message ?? "unknown").slice(0, 300)}`);
    return reply.result;
  }
  async function initialize() {
    if (ready) return;
    const response = await send("initialize", {
      protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "aurora-puremix", version: "1.0.0" },
    });
    if (!response?.protocolVersion) throw new Error("Moises MCP did not negotiate a protocol version");
    await send("notifications/initialized", {}, true);
    ready = true;
  }
  async function listTools() {
    await initialize();
    const tools = [];
    const seen = new Set();
    let cursor;
    do {
      const result = await send("tools/list", cursor ? { cursor } : {});
      if (!Array.isArray(result?.tools)) throw new Error("Invalid Moises MCP tool list");
      tools.push(...result.tools);
      cursor = result.nextCursor;
      if (tools.length > 500 || (cursor && seen.has(cursor))) throw new Error("Invalid MCP pagination");
      if (cursor) seen.add(cursor);
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
