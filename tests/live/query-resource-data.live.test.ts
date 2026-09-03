import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE, LIVE_RESOURCE_ID } from "./live-gate.js";

describe.skipIf(!LIVE)("live: query_resource_data", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("returns tabular rows with a total > 0", async () => {
    const result = await server.client.callTool({
      name: "query_resource_data",
      arguments: { resource_id: LIVE_RESOURCE_ID, page_size: 5 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      resource_id: string;
      total: number;
      columns: string[];
      rows: Array<Record<string, unknown>>;
    };
    expect(structured.resource_id).toBe(LIVE_RESOURCE_ID);
    expect(structured.total).toBeGreaterThan(0);
    expect(structured.columns.length).toBeGreaterThan(0);
    expect(structured.rows.length).toBeGreaterThan(0);
  });
});
