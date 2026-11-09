/**
 * Server-side Moises MCP configuration. Never store a personal MCP token in Git.
 * MOISES_MCP_URL must be supplied through the deployment's secret manager.
 */
export function getMoisesMcpEndpoint(env: NodeJS.ProcessEnv = process.env): URL {
  const raw = env.MOISES_MCP_URL;
  if (!raw) throw new Error("MOISES_MCP_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "mcp.moises.ai") throw new Error("Untrusted Moises MCP endpoint");
  if (!url.pathname.startsWith("/mcp/")) throw new Error("Invalid Moises MCP endpoint path");
  return url;
}
export function getMoisesMcpStatus(env: NodeJS.ProcessEnv = process.env): { configured: boolean; provider: "moises" } {
  try { getMoisesMcpEndpoint(env); return { configured: true, provider: "moises" }; }
  catch { return { configured: false, provider: "moises" }; }
}
