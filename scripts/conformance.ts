#!/usr/bin/env tsx
/**
 * Loopback MCP conformance: start Streamable HTTP, then initialize + tools/list +
 * one tools/call. Exits 0 on success, 1 otherwise.
 *
 *   pnpm test:conformance
 *
 * Network is stubbed (fixture-backed fetch) so CI can run this offline.
 * The GitHub Actions step is `continue-on-error: true` until the suite is
 * treated as a hard gate.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadConfig } from "../src/core/config.js";
import { createDeps } from "../src/server/deps.js";
import { runHttp } from "../src/server/http.js";

const FIXTURE = readFileSync(
  resolve(process.cwd(), "tests/fixtures/datagouv/datasets-search-population.json"),
  "utf8",
);

const TIMEOUT_MS = 15_000;

function stubFetch(input: string | URL): Promise<Response> {
  const url = String(input);
  if (url.includes("/api/2/datasets/search/")) {
    return Promise.resolve(
      new Response(FIXTURE, { headers: { "content-type": "application/json" } }),
    );
  }
  return Promise.resolve(new Response("not mocked", { status: 404 }));
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timeout after ${TIMEOUT_MS}ms: ${label}`)),
      TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const config = loadConfig({
    HTTP_RETRIES: "0",
    MCP_HOST: "127.0.0.1",
    LOG_LEVEL: "silent",
  });
  const deps = createDeps(config, { fetchImpl: stubFetch });
  const running = await runHttp(deps, 0, "127.0.0.1");
  const client = new Client({ name: "conformance", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${running.port}/mcp`),
  );

  try {
    await withTimeout(client.connect(transport), "initialize");
    const { tools } = await withTimeout(client.listTools(), "tools/list");
    if (tools.length < 21) {
      throw new Error(`tools/list returned ${tools.length} tools (expected ≥ 21)`);
    }
    const names = tools.map((t) => t.name);
    if (!names.includes("search_datasets")) {
      throw new Error("tools/list missing search_datasets");
    }
    const result = await withTimeout(
      client.callTool({ name: "search_datasets", arguments: { query: "population" } }),
      "tools/call search_datasets",
    );
    if (result.isError) {
      throw new Error("tools/call search_datasets returned isError");
    }
    const structured = result.structuredContent as { total?: number } | undefined;
    if (structured?.total !== 1234) {
      throw new Error(`unexpected structuredContent.total: ${String(structured?.total)}`);
    }
    console.log(`conformance OK — ${tools.length} tools, search_datasets total=${structured.total}`);
  } finally {
    await client.close().catch(() => undefined);
    await running.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("conformance FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
