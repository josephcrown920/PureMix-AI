import { test } from "node:test";
import assert from "node:assert/strict";
import { moisesEndpoint, createMoisesClient } from "./moises-mcp.server.mjs";
test("rejects unsafe endpoint", () => {
  assert.throws(() => moisesEndpoint({ MOISES_MCP_URL: "https://evil.example/mcp/token" }));
  assert.throws(() => moisesEndpoint({ MOISES_MCP_URL: "http://mcp.moises.ai/mcp/token" }));
  assert.equal(moisesEndpoint({ MOISES_MCP_URL: "https://mcp.moises.ai/mcp/token" }).hostname, "mcp.moises.ai");
});
test("handshake and paginated discovery", async () => {
  const requests = [];
  const fetchImpl = async (_, init) => {
    const p = JSON.parse(init.body); requests.push(p);
    const result = p.method === "initialize" ? { protocolVersion: "2025-03-26" } :
      p.method === "tools/list" ? (p.params.cursor ? { tools: [{ name: "master" }] } : { tools: [{ name: "stems" }], nextCursor: "next" }) : null;
    return { ok: true, status: p.method === "notifications/initialized" ? 202 : 200,
      headers: { get: () => "application/json" }, text: async () => JSON.stringify({ jsonrpc: "2.0", id: p.id, result }) };
  };
  const client = createMoisesClient({ endpoint: new URL("https://mcp.moises.ai/mcp/test"), fetchImpl });
  assert.deepEqual((await client.listTools()).map(t => t.name), ["stems", "master"]);
  assert.equal(requests.filter(r => r.method === "initialize").length, 1);
  await client.listTools();
  assert.equal(requests.filter(r => r.method === "initialize").length, 1);
});
test("requires approval before remote call", async () => {
  const client = createMoisesClient({ endpoint: new URL("https://mcp.moises.ai/mcp/test"), fetchImpl: async () => { throw Error("unexpected"); } });
  await assert.rejects(client.callTool("stems"), /approval/);
});
test("rejects mismatched RPC response", async () => {
  const client = createMoisesClient({ endpoint: new URL("https://mcp.moises.ai/mcp/test"), fetchImpl: async () => ({
    ok: true, status: 200, headers: { get: () => "application/json" },
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: 999, result: { protocolVersion: "2025-03-26" } }),
  }) });
  await assert.rejects(client.initialize(), /matching JSON-RPC/);
});
