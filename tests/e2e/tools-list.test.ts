import { afterEach, describe, expect, it } from "vitest";
import { ALL_TOOLS } from "../../src/tools/index.js";
import { routedFetch, startTestServer, type TestServer } from "../helpers/mcp-client.js";

/**
 * Frozen registration order (ADR 0007 legacy first, then new tools alphabetically
 * as in `src/tools/index.ts`). Bump this list only when adding/removing a tool.
 */
const EXPECTED_REGISTERED_TOOLS = [
  "search_datasets",
  "search_organizations",
  "search_dataservices",
  "get_dataservice_info",
  "get_dataservice_openapi_spec",
  "get_dataset_info",
  "list_dataset_resources",
  "get_resource_info",
  "query_resource_data",
  "get_metrics",
  "check_resource_availability",
  "get_dataset_resources_summary",
  "get_resource_schema",
  "get_reuse_info",
  "list_high_value_datasets",
  "list_topics",
  "get_topic",
  "preview_resource",
  "query_resource",
  "search_reuses",
  "suggest",
] as const;

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

  it("keeps tool registration names and availability stable", async () => {
    server = await startTestServer({ fetchImpl: routedFetch([]) });
    const { tools } = await server.client.listTools();
    const listed = tools.map((t) => t.name);
    const registered = ALL_TOOLS.map((t) => t.name);

    expect(registered).toEqual([...EXPECTED_REGISTERED_TOOLS]);
    expect(listed).toEqual([...EXPECTED_REGISTERED_TOOLS]);
    expect(new Set(listed).size).toBe(EXPECTED_REGISTERED_TOOLS.length);

    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      });
    }
  });
});
