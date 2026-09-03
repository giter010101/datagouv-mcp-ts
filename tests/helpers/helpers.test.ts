import { afterEach, describe, expect, it } from "vitest";
import { FAKE_IDS, fakeClients, fakeFormatsDeps } from "./fakes.js";
import { startTestServer, type TestServer } from "./mcp-client.js";
import { loadFixture, mockDatagouv } from "./mock-datagouv.js";

/** Self-tests for the shared helpers (workstream D). */
describe("tests/helpers", () => {
  let server: TestServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("mockDatagouv serves fixtures through the injected fetchImpl and blocks everything else", async () => {
    const mock = mockDatagouv();
    mock.v2("/datasets/search/", { fixture: "datagouv/datasets-search-population" });

    server = await startTestServer({ fetchImpl: mock.fetchImpl });
    const ok = await server.callToolOk<{ total: number }>("search_datasets", {
      query: "population",
    });
    expect(ok.structured?.total).toBe(1234);
    expect(mock.calls[0]?.path).toBe("/api/2/datasets/search/");

    // Unregistered route → the HTTP layer maps the mock error to a NETWORK_ERROR, never a live call.
    const res = await mock
      .fetchImpl("https://www.data.gouv.fr/api/1/datasets/unknown/")
      .catch((e: Error) => e);
    expect(res).toBeInstanceOf(Error);
    await mock.close();
  });

  it("mockDatagouv supports status codes, dynamic responders and query matching", async () => {
    const mock = mockDatagouv();
    mock.v1("/datasets/nope/", { status: 404, json: { message: "not found" } });
    mock.tabular(/\/resources\/[^/]+\/data\/\?.*page=2/, {
      respond: ({ query }) => ({ json: { page: Number(query.get("page")) } }),
    });

    const notFound = await mock.fetchImpl("https://www.data.gouv.fr/api/1/datasets/nope/");
    expect(notFound.status).toBe(404);
    const page = await mock.fetchImpl(
      "https://tabular-api.data.gouv.fr/api/resources/x/data/?page=2&page_size=5",
    );
    expect(await page.json()).toEqual({ page: 2 });
    await mock.close();
  });

  it("loadFixture resolves names under tests/fixtures/api then tests/fixtures", () => {
    const fixture = loadFixture<{ total: number }>("datagouv/datasets-search-population");
    expect(fixture.total).toBe(1234);
    expect(() => loadFixture("does/not/exist")).toThrow(/fixtures:record/);
  });

  it("fakeClients returns deterministic data, records calls and 404s on unknown ids", async () => {
    const clients = fakeClients();
    const dataset = await clients.datagouv.getDataset(FAKE_IDS.dataset);
    expect(dataset.resources.length).toBeGreaterThan(0);
    await expect(clients.datagouv.getDataset("unknown")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await clients.tabular.getProfile(FAKE_IDS.resourceTabularCsv)).toBeDefined();
    expect(await clients.crawler.getResourceExceptions()).toContain(FAKE_IDS.resourceLargeCsv);
    expect(clients.calls.map((c) => c.method)).toEqual([
      "datagouv.getDataset",
      "datagouv.getDataset",
      "tabular.getProfile",
      "crawler.getResourceExceptions",
    ]);
  });

  it("fakeFormatsDeps resolves a queryable accessor from a canned capability report", async () => {
    const formats = fakeFormatsDeps({ report: { primary: "stream_parse" } });
    const clients = fakeClients();
    const resource = await clients.datagouv.getResource(FAKE_IDS.resourceTabularCsv);
    const report = await formats.detectCapability(resource, { offline: true });
    expect(report.primary).toBe("stream_parse");
    const accessor = formats.registry.resolve({ resource, report, maxDownloadBytes: 1 });
    const slice = await accessor.query?.({ resource, report, maxDownloadBytes: 1 }, { page: 3 });
    expect(slice?.page).toBe(3);
    expect(formats.calls[0]?.method).toBe("detectCapability");
  });
});
