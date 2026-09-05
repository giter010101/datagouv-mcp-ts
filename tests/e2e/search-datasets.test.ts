import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { routedFetch, startTestServer, type TestServer } from "../helpers/mcp-client.js";

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "tests/fixtures/datagouv/datasets-search-population.json"),
    "utf8",
  ),
) as Record<string, unknown>;

const EMPTY = { data: [], page: 1, page_size: 20, total: 0, next_page: null };

describe("MCP e2e: search_datasets", () => {
  let server: TestServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("is listed with legacy-compatible name, annotations and input schema", async () => {
    server = await startTestServer({ fetchImpl: routedFetch([]) });
    const { tools } = await server.client.listTools();
    const tool = tools.find((t) => t.name === "search_datasets");
    expect(tool).toBeDefined();
    expect(tool?.title).toBe("Search datasets");
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    const props = tool?.inputSchema.properties ?? {};
    expect(Object.keys(props).sort()).toEqual([
      "badge",
      "format",
      "geozone",
      "granularity",
      "last_update_range",
      "license",
      "organization",
      "page",
      "page_size",
      "query",
      "schema",
      "sort",
      "tag",
      "topic",
    ]);
    expect(tool?.inputSchema.required).toEqual(["query"]);
  });

  it("returns text + structuredContent from the API v2 search response", async () => {
    const fetchImpl = routedFetch([
      { match: "/api/2/datasets/search/", respond: () => Response.json(fixture) },
    ]);
    server = await startTestServer({ fetchImpl });

    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "population", page_size: 2 },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    expect(text).toContain("Found 1234 dataset(s) for query: 'population'");
    expect(text).toContain("1. Population");
    expect(text).toContain("ID: 53699d0ea3a729239d205b2e");
    expect(text).toContain("Organization: Institut National de la Statistique");
    expect(text).toContain("Tags: population, recensement, insee, communes, demographie");
    expect(text).toContain("Resources: 14");
    expect(text).toContain("URL: https://www.data.gouv.fr/datasets/population/");
    expect(text).toContain("use page=2");

    const structured = result.structuredContent as {
      total: number;
      page: number;
      has_next: boolean;
      effective_query: string;
      datasets: Array<{
        id: string;
        organization?: string;
        resources_count: number;
        description_short: string;
      }>;
    };
    expect(structured.total).toBe(1234);
    expect(structured.has_next).toBe(true);
    expect(structured.effective_query).toBe("population");
    expect(structured.datasets).toHaveLength(2);
    expect(structured.datasets[1]?.organization).toBeUndefined();
    expect(structured.datasets[1]?.description_short).toBe(
      "Population municipale Chiffres officiels issus du recensement. Deuxième paragraphe.",
    );
    expect(structured.datasets[0]?.resources_count).toBe(14);

    const requested = fetchImpl.calls[0];
    expect(requested?.searchParams.get("q")).toBe("population");
    expect(requested?.searchParams.get("page_size")).toBe("2");
  });

  it("strips stop words and falls back to the original query when cleaned yields nothing", async () => {
    const fetchImpl = routedFetch([
      {
        match: "/api/2/datasets/search/",
        respond: (url) =>
          Response.json(url.searchParams.get("q") === "population csv" ? fixture : EMPTY),
      },
    ]);
    server = await startTestServer({ fetchImpl });

    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "population csv" },
    });

    expect(fetchImpl.calls.map((u) => u.searchParams.get("q"))).toEqual([
      "population",
      "population csv",
    ]);
    expect((result.structuredContent as { effective_query: string }).effective_query).toBe(
      "population csv",
    );
    expect((result.structuredContent as { total: number }).total).toBe(1234);
  });

  it("passes sort and last_update_range through and reports no results", async () => {
    const fetchImpl = routedFetch([
      { match: "/api/2/datasets/search/", respond: () => Response.json(EMPTY) },
    ]);
    server = await startTestServer({ fetchImpl });

    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "radars", sort: "-last_update", last_update_range: "last_30_days" },
    });
    expect((result.content as Array<{ text: string }>)[0]?.text).toBe(
      "No datasets found for query: 'radars'",
    );
    expect(fetchImpl.calls[0]?.searchParams.get("sort")).toBe("-last_update");
    expect(fetchImpl.calls[0]?.searchParams.get("last_update_range")).toBe("last_30_days");
  });

  it("passes facet filters through to API v2 search", async () => {
    const fetchImpl = routedFetch([
      { match: "/api/2/datasets/search/", respond: () => Response.json(EMPTY) },
    ]);
    server = await startTestServer({ fetchImpl });

    await server.client.callTool({
      name: "search_datasets",
      arguments: {
        query: "population",
        organization: "61937d50e54eade2bbf8e8df",
        tag: "insee, recensement",
        license: "fr-lo",
        format: "csv",
        badge: "hvd",
        geozone: "country:fr",
        granularity: "commune",
        schema: "etalab/schema-irve-statique",
        topic: "topic-id",
      },
    });
    const params = fetchImpl.calls[0]?.searchParams;
    expect(params?.get("organization")).toBe("61937d50e54eade2bbf8e8df");
    expect(params?.get("tag")).toBe("insee,recensement");
    expect(params?.get("license")).toBe("fr-lo");
    expect(params?.get("format")).toBe("csv");
    expect(params?.get("badge")).toBe("hvd");
    expect(params?.get("geozone")).toBe("country:fr");
    expect(params?.get("granularity")).toBe("commune");
    expect(params?.get("schema")).toBe("etalab/schema-irve-statique");
    expect(params?.get("topic")).toBe("topic-id");
  });

  it("rejects invalid input at the protocol level", async () => {
    server = await startTestServer({ fetchImpl: routedFetch([]) });
    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "x", page_size: 500 },
    });
    expect(result.isError).toBe(true);
  });

  it("maps upstream failures to a structured isError result instead of throwing", async () => {
    const fetchImpl = routedFetch([
      {
        match: "/api/2/datasets/search/",
        respond: () => new Response("upstream down", { status: 502 }),
      },
    ]);
    server = await startTestServer({ fetchImpl });

    const result = await server.client.callTool({
      name: "search_datasets",
      arguments: { query: "x" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
    expect(text).toMatch(/^Error \[API_ERROR\]: HTTP 502/);
    expect(result.structuredContent).toMatchObject({
      error: { code: "API_ERROR", retryable: true },
    });
  });
});
