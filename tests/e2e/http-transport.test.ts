import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { createDeps, type ServerDeps } from "../../src/server/deps.js";
import { createHttpApp, type RunningHttpServer, runHttp } from "../../src/server/http.js";
import { routedFetch } from "../helpers/mcp-client.js";

const fixture = readFileSync(
  resolve(process.cwd(), "tests/fixtures/datagouv/datasets-search-population.json"),
  "utf8",
);

describe("Streamable HTTP transport", () => {
  let running: RunningHttpServer;
  let deps: ServerDeps;
  let upstreamOk = true;

  beforeAll(async () => {
    const config = loadConfig({ HTTP_RETRIES: "0", MCP_HOST: "127.0.0.1" });
    const fetchImpl = routedFetch([
      {
        match: "/api/2/datasets/search/",
        respond: () =>
          upstreamOk
            ? new Response(fixture, { headers: { "content-type": "application/json" } })
            : new Response("down", { status: 503 }),
      },
    ]);
    deps = createDeps(config, { fetchImpl });
    running = await runHttp(deps, 0, "127.0.0.1");
  });

  afterAll(async () => {
    await running.close();
  });

  it("GET /health returns the legacy JSON shape when the probe succeeds", async () => {
    const res = await fetch(`http://127.0.0.1:${running.port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.env).toBe("local");
    expect(body.data_env).toBe("prod");
    expect(typeof body.version).toBe("string");
    expect(typeof body.uptime_since).toBe("string");
  });

  it("GET /health returns 503 mcp_unavailable when upstream is down", async () => {
    upstreamOk = false;
    deps.cache.clear();
    try {
      const res = await fetch(`http://127.0.0.1:${running.port}/health`);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ status: "mcp_unavailable" });
    } finally {
      upstreamOk = true;
    }
  });

  it("serves MCP over POST /mcp (stateless) for the SDK client", async () => {
    const client = new Client({ name: "http-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${running.port}/mcp`),
    );
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("search_datasets");
      const result = await client.callTool({
        name: "search_datasets",
        arguments: { query: "population" },
      });
      expect(result.isError).toBeFalsy();
      expect((result.structuredContent as { total: number }).total).toBe(1234);
    } finally {
      await client.close();
    }
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await fetch(`http://127.0.0.1:${running.port}/nope`);
    expect(res.status).toBe(404);
  });

  it("rejects unexpected Host and Origin headers (DNS rebinding protection)", async () => {
    const config = loadConfig({});
    const app = createHttpApp(createDeps(config, { fetchImpl: routedFetch([]) }));
    const badHost = await app.request("http://evil.example/health", {
      headers: { host: "evil.example" },
    });
    expect(badHost.status).toBe(421);
    const badOrigin = await app.request("http://localhost/mcp", {
      method: "POST",
      headers: { host: "localhost:8000", origin: "https://evil.example" },
    });
    expect(badOrigin.status).toBe(403);
    const okOrigin = await app.request("http://localhost/nope", {
      headers: { host: "localhost:8000", origin: "http://localhost:5173" },
    });
    expect(okOrigin.status).toBe(404);
  });
});
