import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE, LIVE_RESOURCE_ID } from "./live-gate.js";

describe.skipIf(!LIVE)("live: preview_resource", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("previews a tabular resource without asserting exact titles", async () => {
    const result = await server.client.callTool({
      name: "preview_resource",
      arguments: { resource_id: LIVE_RESOURCE_ID, limit: 5 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      resource_id: string;
      kind: string;
      table?: { total: number; rows: unknown[]; columns: string[] };
    };
    expect(structured.resource_id).toBe(LIVE_RESOURCE_ID);
    expect(structured.kind.length).toBeGreaterThan(0);
    if (structured.table) {
      expect(structured.table.total).toBeGreaterThan(0);
      expect(structured.table.columns.length).toBeGreaterThan(0);
      expect(structured.table.rows.length).toBeGreaterThan(0);
    }
  });
});
