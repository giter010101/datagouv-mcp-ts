import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ALL_TOOLS } from "../../src/tools/index.js";
import { startTestServer, type TestServer } from "../helpers/mcp-client.js";
import { loadFixture, mockDatagouv } from "../helpers/mock-datagouv.js";

const DATASET_ID = "53699d0ea3a729239d205b2e";
const RESOURCE_ID = "a86ebc34-a979-4d6c-8f2a-9710a43dca93";
const DATASERVICE_ID = "672cf67802ef6b1be63b8975";
const REUSE_ID = "6a96cc1b2aeed626b1cb300e";
const TOPIC_ID = "68d26d38c8f655382d59e3ac";
const RESOURCE_DATASET_ID = "6a9899255369f45f95bdd226";
const TOPIC_DATASET_ID = "67e43007cd5e91b9fdcbc7b3";

const OPENAPI_YAML = readFileSync(
  resolve(process.cwd(), "tests/fixtures/api/openapi/geocodage-openapi.yaml"),
  "utf8",
);

const WRITE_EVIDENCE = process.env.EVIDENCE_WRITE === "1";
const EVIDENCE_DATE = "2026-09-03";

/** One offline call per registered tool (fixtures via mockDatagouv). */
const OFFLINE_TOOL_CASES: ReadonlyArray<{
  name: string;
  args: Record<string, unknown>;
  expectText: string;
}> = [
  { name: "search_datasets", args: { query: "population", page_size: 3 }, expectText: "dataset" },
  { name: "search_organizations", args: { query: "etalab", page_size: 3 }, expectText: "etalab" },
  {
    name: "search_dataservices",
    args: { query: "adresse", page_size: 3 },
    expectText: "adresse",
  },
  { name: "get_dataservice_info", args: { dataservice_id: DATASERVICE_ID }, expectText: "API" },
  {
    name: "get_dataservice_openapi_spec",
    args: { dataservice_id: DATASERVICE_ID },
    expectText: "OpenAPI",
  },
  { name: "get_dataset_info", args: { dataset_id: DATASET_ID }, expectText: "Population" },
  {
    name: "list_dataset_resources",
    args: { dataset_id: DATASET_ID, page_size: 5 },
    expectText: "Resource",
  },
  { name: "get_resource_info", args: { resource_id: RESOURCE_ID }, expectText: "Resource" },
  {
    name: "query_resource_data",
    args: { resource_id: RESOURCE_ID, page_size: 5 },
    expectText: "row",
  },
  { name: "get_metrics", args: { dataset_id: DATASET_ID, limit: 3 }, expectText: "metric" },
  {
    name: "check_resource_availability",
    args: { resource_id: RESOURCE_ID, live: false },
    expectText: "Availability",
  },
  {
    name: "get_dataset_resources_summary",
    args: { dataset_id: DATASET_ID },
    expectText: "resource",
  },
  { name: "get_resource_schema", args: { resource_id: RESOURCE_ID }, expectText: "Schema" },
  { name: "get_reuse_info", args: { reuse_id: REUSE_ID }, expectText: "Reuse" },
  {
    name: "list_high_value_datasets",
    args: { page_size: 3 },
    expectText: "high value",
  },
  { name: "list_topics", args: { query: "transport", page_size: 3 }, expectText: "topic" },
  { name: "get_topic", args: { topic_id: TOPIC_ID }, expectText: "Topic" },
  { name: "preview_resource", args: { resource_id: RESOURCE_ID, limit: 5 }, expectText: "Preview" },
  {
    name: "query_resource",
    args: { resource_id: RESOURCE_ID, page_size: 5 },
    expectText: "Query",
  },
  {
    name: "search_reuses",
    args: { dataset_id: DATASET_ID, page_size: 3 },
    expectText: "reuse",
  },
  { name: "suggest", args: { query: "popu", size: 5 }, expectText: "Suggest" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Recorded fixtures redact some fields as strings; Zod schemas expect objects. */
function sanitizeDataset(raw: unknown): Record<string, unknown> {
  const dataset = asRecord(raw);
  const resources = Array.isArray(dataset.resources)
    ? dataset.resources.map((item) => {
        const resource = asRecord(item);
        return { ...resource, url: typeof resource.url === "string" ? resource.url : "" };
      })
    : dataset.resources;
  return { ...dataset, resources };
}

function sanitizeOrgPage(raw: unknown): Record<string, unknown> {
  const page = asRecord(raw);
  const data = Array.isArray(page.data)
    ? page.data.map((item) => {
        const org = asRecord(item);
        return {
          ...org,
          metrics: typeof org.metrics === "object" && org.metrics !== null ? org.metrics : {},
        };
      })
    : page.data;
  return { ...page, data };
}

function wireCatalogue() {
  const mock = mockDatagouv();
  const reusesPage = loadFixture<{ data: Array<Record<string, unknown>> }>(
    "datagouv/reuses-population",
  );
  const firstReuse = reusesPage.data[0];
  if (!firstReuse) throw new Error("reuses-population fixture has no data");
  const dataset = sanitizeDataset(loadFixture("datagouv/dataset-population-v1"));

  mock.v2("/datasets/search/", {
    respond: ({ query }) => ({
      json:
        query.get("badge") === "hvd"
          ? loadFixture("datagouv/datasets-search-hvd")
          : loadFixture("datagouv/datasets-search-population"),
    }),
  });
  mock.v2("/organizations/search/", {
    respond: () => ({ json: sanitizeOrgPage(loadFixture("datagouv/organizations-search-etalab")) }),
  });
  mock.v2("/dataservices/search/", { fixture: "datagouv/dataservices-search-adresse" });
  mock.v2(`/datasets/resources/${RESOURCE_ID}/`, { fixture: "datagouv/resource-tabular-csv" });
  mock.v2("/topics/search/", { fixture: "datagouv/topics-search-transport" });
  mock.v2(`/topics/${TOPIC_ID}/`, { fixture: "datagouv/topic-detail-v2" });
  mock.v2(`/topics/${TOPIC_ID}/elements/`, { fixture: "datagouv/topic-elements-v2-p1" });

  mock.v1(`/datasets/${DATASET_ID}/`, { json: dataset });
  mock.v1(`/datasets/${RESOURCE_DATASET_ID}/`, { json: dataset });
  mock.v1(`/datasets/${TOPIC_DATASET_ID}/`, { json: dataset });
  mock.v1(`/dataservices/${DATASERVICE_ID}/`, { fixture: "datagouv/dataservice-api-adresse" });
  mock.v1("/reuses/", { fixture: "datagouv/reuses-population" });
  mock.v1(`/reuses/${REUSE_ID}/`, { json: firstReuse });
  mock.v1("/datasets/suggest/", { fixture: "datagouv/suggest-datasets-popu" });
  mock.v1("/organizations/suggest/", { fixture: "datagouv/suggest-organizations-insee" });
  mock.v1("/tags/suggest/", { fixture: "datagouv/suggest-tags-tran" });
  mock.v1("/spatial/zones/suggest/", { fixture: "datagouv/suggest-zones-paris" });

  mock.tabular(`/resources/${RESOURCE_ID}/profile/`, { fixture: "tabular/profile-a86ebc34" });
  mock.tabular(`/resources/${RESOURCE_ID}/data/`, { fixture: "tabular/data-a86ebc34-page1" });
  mock.metrics("/datasets/data/", { fixture: "metrics/datasets-population" });
  mock.crawler("/resources-exceptions", { fixture: "crawler/resources-exceptions" });
  mock.route("https://data.geopf.fr", (path) => path.split("?")[0] === "/geocodage/openapi.yaml", {
    text: OPENAPI_YAML,
    headers: { "content-type": "application/yaml" },
  });

  return mock;
}

function writeEvidenceFile(params: {
  name: string;
  args: Record<string, unknown>;
  text: string;
  structured: Record<string, unknown> | undefined;
  isError: boolean;
  durationMs: number;
}): void {
  const dir = resolve(process.cwd(), "docs/evidence");
  mkdirSync(dir, { recursive: true });
  const maxLines = 40;
  const lines = params.text.split("\n");
  const truncated =
    lines.length > maxLines
      ? `${lines.slice(0, maxLines).join("\n")}\n… (${lines.length - maxLines} more lines)`
      : params.text;
  const status = params.isError ? "FAIL" : "PASS";
  const keys = params.structured
    ? Object.keys(params.structured)
        .map((k) => `- \`${k}\``)
        .join("\n")
    : "_none_";
  const report = `# Evidence: ${params.name} (offline fixtures)

**Date**: ${EVIDENCE_DATE}
**Agent**: Composer (evidence coverage)
**Status**: ${status}
**Transport**: in-process MCP (\`startTestServer\` + \`mockDatagouv\`)
**Duration**: ${params.durationMs} ms
**Data env**: fixtures (recorded under \`tests/fixtures/api\`)

## Input
\`\`\`json
${JSON.stringify(params.args, null, 2)}
\`\`\`

## Output (text, truncated)
\`\`\`text
${truncated}
\`\`\`

## structuredContent (keys)
${keys}

## Assertions
- [${params.isError ? " " : "x"}] Tool returned without \`isError\`
- [${params.text.length > 0 ? "x" : " "}] Text content present (${params.text.length} chars)
- [${params.structured ? "x" : " "}] \`structuredContent\` present

## Reproduce
\`\`\`bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
\`\`\`
`;
  writeFileSync(resolve(dir, `${params.name}-offline-${EVIDENCE_DATE}.md`), report);
}

describe("MCP e2e: all registered tools (offline fixtures)", () => {
  let server: TestServer | undefined;
  let mock: ReturnType<typeof mockDatagouv> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await mock?.close();
    mock = undefined;
  });

  it("covers every ALL_TOOLS name exactly once", () => {
    const registered = ALL_TOOLS.map((t) => t.name);
    const cases = OFFLINE_TOOL_CASES.map((c) => c.name);
    expect(cases).toEqual(registered);
    expect(new Set(cases).size).toBe(registered.length);
  });

  it.each(OFFLINE_TOOL_CASES)("calls $name without isError", async (toolCase) => {
    mock = wireCatalogue();
    server = await startTestServer({ fetchImpl: mock.fetchImpl });
    const result = await server.callTool(toolCase.name, toolCase.args);
    expect(result.isError, result.text.slice(0, 800)).toBe(false);
    expect(result.text.toLowerCase()).toContain(toolCase.expectText.toLowerCase());
    expect(result.structured).toBeTypeOf("object");
    if (WRITE_EVIDENCE) {
      writeEvidenceFile({
        name: toolCase.name,
        args: toolCase.args,
        text: result.text,
        structured: result.structured,
        isError: result.isError,
        durationMs: result.durationMs,
      });
    }
  });
});
