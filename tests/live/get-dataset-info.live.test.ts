import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE, LIVE_DATASET_ID } from "./live-gate.js";

describe.skipIf(!LIVE)("live: get_dataset_info", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("returns a dataset with an id and at least one resource", async () => {
    const result = await server.client.callTool({
      name: "get_dataset_info",
      arguments: { dataset_id: LIVE_DATASET_ID },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      dataset: { id: string; resources_count: number };
    };
    expect(structured.dataset.id).toEqual(expect.any(String));
    expect(structured.dataset.id.length).toBeGreaterThan(0);
    expect(structured.dataset.resources_count).toBeGreaterThan(0);
  });
});
