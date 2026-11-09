import { test } from "node:test";
import assert from "node:assert/strict";
import { moisesEndpoint, createMoisesClient } from "./moises-mcp.server.mjs";
test("endpoint requires valid host and path", () => {
  assert.throws(() => moisesEndpoint({ MOISES_MCP_URL: "https://example.com/mcp/token" }));
  assert.throws(() => moisesEndpoint({ MOISES_MCP_URL: "http://mcp.moises.ai/mcp/token" }));
  assert.equal(moisesEndpoint({ MOISES_MCP_URL: "https://mcp.moises.ai/mcp/testtoken" }).hostname, "mcp.moises.ai");
});
test("discovers tools using MCP handshake and pagination", async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const p = JSON.parse(init.body); requests.push(p);
    const result = p.method === "initialize" ? { protocolVersion: "2025-03-26" }
      : p.method === "tools/list" ? (p.params.cursor ? { tools: [{ name: "master" }] } : { tools: [{ name: "stems" }], nextCursor: "next" }) : null;
    return { ok: true, status: p.method === "notifications/initialized" ? 202 : 200,
      headers: { get: () => "application/json" }, text: async () => JSON.stringify({ jsonrpc: "2.0", id: p.id, result }) };
  };
  const client = createMoisesClient({ endpoint: new URL("https://mcp.moises.ai/mcp/test"), fetchImpl });
  assert.deepEqual((await client.listTools()).map(t => t.name), ["stems", "master"]);
  assert.equal(requests[1].method, "notifications/initialized");
});
test("tool execution requires approval", async () => {
  const client = createMoisesClient({ endpoint: new URL("https://mcp.moises.ai/mcp/test"), fetchImpl: async () => { throw Error("should not call"); } });
  await assert.rejects(client.callTool("stems"), /approval/);
});
