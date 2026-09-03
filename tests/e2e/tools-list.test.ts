import { afterEach, describe, expect, it } from "vitest";
import { ALL_TOOLS } from "../../src/tools/index.js";
import { routedFetch, startTestServer, type TestServer } from "../helpers/mcp-client.js";

/** The 10 Python-server tools, in ADR 0007 / ALL_TOOLS registration order. */
const LEGACY_TOOL_NAMES = ALL_TOOLS.filter((t) => t.legacy === true).map((t) => t.name);

describe("MCP e2e: tools/list", () => {
  let server: TestServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("lists every registered tool by name, with legacy tools first", async () => {
    server = await startTestServer({ fetchImpl: routedFetch([]) });
    const { tools } = await server.client.listTools();
    const listed = tools.map((t) => t.name);
    const registered = ALL_TOOLS.map((t) => t.name);

    for (const name of registered) {
      expect(listed).toContain(name);
    }
    expect(listed.length).toBeGreaterThanOrEqual(21);
    expect(registered.length).toBeGreaterThanOrEqual(21);
    expect(listed).toEqual(registered);

    expect(LEGACY_TOOL_NAMES).toHaveLength(10);
    expect(listed.slice(0, 10)).toEqual(LEGACY_TOOL_NAMES);
    expect(registered.slice(0, 10)).toEqual(LEGACY_TOOL_NAMES);
  });
});
