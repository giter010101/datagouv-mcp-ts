# Test helpers (owned by workstream D)

Shared building blocks for unit, contract, e2e and live tests. Import them with
relative paths (`../helpers/<file>.js`). Nothing here touches the real network.

| File | Exports | Use it for |
|------|---------|-----------|
| `mock-datagouv.ts` | `mockDatagouv()`, `loadFixture()`, `v2Page()`, `tabularPage()` | Contract / e2e tests replaying recorded API responses through an undici `MockAgent` |
| `mcp-client.ts` | `createTestMcpClient(server)`, `startTestServer()`, `routedFetch()`, `firstText()` | In-process MCP client over `InMemoryTransport` |
| `fakes.ts` | `fakeClients()`, `fakeFormatsDeps()`, `fakeAccessor()`, `fakeQueryEngine()`, entity builders, `FAKE_IDS` | Unit-testing tools/formats against the shared contracts without A/B code |
| `helpers.test.ts` | — | Self-tests of the helpers (run in the offline suite) |

## `mockDatagouv()` — network fixtures

```ts
import { mockDatagouv } from "../helpers/mock-datagouv.js";
import { startTestServer } from "../helpers/mcp-client.js";

const mock = mockDatagouv();                       // prod base URLs; { env: "demo" } for demo
mock.v2("/datasets/search/", { fixture: "datagouv/datasets-search-population" });
mock.v1("/datasets/53699d0ea3a729239d205b2e/", { fixture: "datagouv/dataset-population" });
mock.tabular("/resources/<rid>/profile/", { status: 404, json: { detail: "Not found" } });
mock.tabular(/\/resources\/<rid>\/data\/\?.*page=2/, {
  respond: ({ query }) => ({ json: tabularPage(rows, { page: Number(query.get("page")) }) }),
});
mock.url("https://static.data.gouv.fr/file.csv", { text: "a,b\n1,2\n", headers: { "content-type": "text/csv" } });

const server = await startTestServer({ fetchImpl: mock.fetchImpl });
const { text, structured, isError } = await server.callTool("search_datasets", { query: "population" });
mock.calls;                        // every request seen (origin, method, path, url)
mock.assertNoPendingInterceptors(); // when using { times: n }
await server.close(); await mock.close();
```

Route builders: `v1`, `v2`, `site`, `tabular`, `metrics`, `crawler`, `schema`, `validata`, `url(absolute)`, `route(origin, path)`.
Path matchers: string (exact pathname, query ignored, trailing slash tolerant), `RegExp` or predicate on `path?query`.
Reply options: `status`, `json`, `text`, `body`, `fixture`, `headers`, `method` (`HEAD` for probes), `query`, `times`, `delayMs`, `respond(fn)`.

Fixtures are looked up in `tests/fixtures/api/<service>/<name>.json` first (recorded by
`pnpm fixtures:record`, see `tests/fixtures/api/manifest.json`) and then in `tests/fixtures/`.
Unmatched requests are rejected (`net.connect` disabled) and surface as `NETWORK_ERROR`.

## `createTestMcpClient(server)` / `startTestServer()`

```ts
const server = await startTestServer({ fetchImpl });          // real deps, fake network
const server = await startTestServer({ deps: myDepsWithFakes }); // spliced deps
const t = await createTestMcpClient(createMcpServer(deps));   // any McpServer

const tools = await t.listTools();
const r = await t.callTool<{ total: number }>("search_datasets", { query: "x" });
r.text / r.structured / r.isError / r.raw / r.durationMs
await t.callToolOk("…");   // throws when isError
await t.close();
```

`startTestServer` sets `HTTP_RETRIES=0` so failure paths are fast. Override with `env` / `config`.

## `fakes.ts` — fake contracts

```ts
const clients = fakeClients({
  datasets: [fakeDatasetDetail({ id: "abc", resources: [fakeResourceDetail({ format: "parquet" })] })],
  tabular: { getProfile: async () => undefined },
});
clients.calls; // [{ method: "datagouv.getDataset", args: ["abc"] }, …]

const formats = fakeFormatsDeps({ report: { primary: "parquet", strategy: "parquet" } });
formats.registry / formats.detectCapability / formats.engine / formats.calls
```

Defaults: one dataset (`FAKE_IDS.dataset`) with a CSV + XLSX resource, a Tabular profile for
every resource except `FAKE_IDS.resourceDeadRemote`, one crawler exception (`FAKE_IDS.resourceLargeCsv`),
metrics for 3 months, the IRVE schema in the catalogue. Unknown ids throw `NotFoundError`.
`FAKE_IDS` mirrors the real IDs from `research/02 §11` so fakes and live tests line up.

## Rules

- Offline projects run with the global undici dispatcher set to a `MockAgent` with `disableNetConnect()`
  (`tests/setup.ts`): a test that forgets to inject `fetchImpl` fails with an explicit error.
- Never write inside the repo from tests; use `os.tmpdir()`.
- Keep helpers dependency-free beyond `undici` and the MCP SDK.
