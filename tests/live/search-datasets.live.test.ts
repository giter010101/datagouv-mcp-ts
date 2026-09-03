import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE } from "./live-gate.js";

/**
 * Live smoke tests against the real data.gouv.fr API.
 * Gated by DATAGOUV_LIVE=1 (alias RUN_LIVE_TESTS=1); run with `pnpm test:live`.
 */
describe.skipIf(!LIVE)("live: search_datasets", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("finds population datasets on production", async () => {
    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "population", page_size: 3 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      total: number;
      datasets: Array<{ id: string; url: string }>;
    };
    expect(structured.total).toBeGreaterThan(100);
    expect(structured.datasets).toHaveLength(3);
    expect(structured.datasets[0]?.url).toMatch(/^https:\/\/www\.data\.gouv\.fr\/datasets\//);
  });
});
