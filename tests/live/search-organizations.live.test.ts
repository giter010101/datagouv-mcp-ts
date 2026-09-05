import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { LIVE } from "./live-gate.js";

describe.skipIf(!LIVE)("live: search_organizations", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({ fetchImpl: (input, init) => fetch(input, init) });
  });

  afterAll(async () => {
    await server.close();
  });

  it("finds organizations for a well-known query", async () => {
    const result = await server.client.callTool({
      name: "search_organizations",
      arguments: { query: "etalab", page_size: 3 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      total: number;
      organizations: Array<{ id: string }>;
    };
    expect(structured.total).toBeGreaterThan(0);
    expect(structured.organizations.length).toBeGreaterThan(0);
    expect(structured.organizations[0]?.id).toEqual(expect.any(String));
    expect(structured.organizations[0]?.id.length).toBeGreaterThan(0);
  });
});
