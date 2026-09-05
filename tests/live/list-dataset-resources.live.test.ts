import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE, LIVE_DATASET_ID } from "./live-gate.js";

describe.skipIf(!LIVE)("live: list_dataset_resources", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("lists resources with ids (count may drift)", async () => {
    const result = await server.client.callTool({
      name: "list_dataset_resources",
      arguments: { dataset_id: LIVE_DATASET_ID, page_size: 8 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      total: number;
      resources: Array<{ id: string }>;
    };
    expect(structured.total).toBeGreaterThan(0);
    expect(structured.resources.length).toBeGreaterThan(0);
    expect(structured.resources[0]?.id).toEqual(expect.any(String));
    expect(structured.resources[0]?.id.length).toBeGreaterThan(0);
  });
});
