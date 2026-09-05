# Skill: resource formats (workstream B)

How tools inspect, preview and query data.gouv.fr resources **without trusting `format`**.

## Public API (`src/formats/index.ts`)

Tools must import from the formats barrel, not from individual parsers:

```ts
import {
  createAccessorRegistry,
  defaultAccessors,
  openResource,
  createCapabilityDetector,
  createEngines,
  detectorDepsFrom,
} from "../formats/index.js";
```

### `openResource(resourceMeta, deps, options?)`

1. `detectCapability` (exec-plan §5, research/03 §7) — never throws; probes become warnings.
2. Resolve a `ResourceAccessor` from `defaultAccessors(deps)`.
3. Return `{ resource, report, accessor, getSchema, preview, query }`.
   - **`preview` never throws** — download/parse failures degrade to `kind: "metadata"` with an explanation.
   - **`query` throws** typed `DatagouvError`s (`UNSUPPORTED_CAPABILITY`, `PAYLOAD_TOO_LARGE`, `ENGINE_UNAVAILABLE`, …).

### Wiring (workstream C)

```ts
const engines = createEngines({
  http,
  maxDownloadBytes: config.http.maxDownloadBytes,
  enableDuckdb: config.engines.duckdb, // ENABLE_DUCKDB=1
});
const formatsDeps: FormatsDeps = {
  http,
  tabular, // TabularClient or undefined
  crawlerExceptions: () => crawler.getResourceExceptions(),
  tabularApiBaseUrl: config.baseUrls.tabular,
  maxDownloadBytes: config.http.maxDownloadBytes,
  engines,
};
const registry = createAccessorRegistry(defaultAccessors(formatsDeps));
const detectCapability = createCapabilityDetector(detectorDepsFrom(formatsDeps));
```

`tools/deps.ts` `FormatsDeps` is `{ registry, detectCapability, engine }` — compose that from the above. Do **not** reimplement accessors in the tools layer.

## Accessor order (capability walk)

`AccessorRegistry.tryResolve` walks `report.capabilities` best-first, then registered accessors:

| id | capabilities | notes |
|----|----------------|-------|
| `tabular-api` | tabular_api, tabular_api_large | server-side filters; no download |
| `hydra-parquet` | parquet | `analysis:parsing:parquet_url` |
| `parquet` | parquet | native file, HTTP range + hyparquet |
| `csv-stream` | stream_parse | csv/tsv/txt, gzip transparent |
| `spreadsheet` | stream_parse | xlsx/xls/ods, `member` = sheet |
| `json` | stream_parse | json / jsonl |
| `geojson` | geo_preview, stream_parse | bbox + features; Hydra geojson_url |
| `xml` | stream_parse | xml/kml/gpx/gml |
| `shapefile` | archive_inspect, geo_preview | ZIP + shpjs, small files only |
| `archive` | archive_inspect | ZIP list + recurse `member` |
| `document` | document_preview | pdf/html/md/txt/docx text extract |
| `api-endpoint` | api_endpoint | WMS/WFS GetCapabilities URL; **never fetches** |
| `metadata-only` | metadata_only, dead_link, remote_caution, … | **always matches, never throws** |

## Engines (ADR 0006)

- **pure-js** always: bounded download → parser → `applyQuery` (same filter/sort/page/aggregate vocabulary as the Tabular API). Rejects `sql`.
- **duckdb** optional: `@duckdb/node-api` dynamic import, `ENABLE_DUCKDB=1`. SELECT-only (`guardReadOnlySql`). Factory `select()` prefers DuckDB for `sql`, parquet, or files ≥ 8 MB when the module loads.
- Accessors call `deps.engines.select()`; tools never import an engine.

## Caps and errors

All file access goes through `downloadBounded` (`MAX_DOWNLOAD_BYTES`). Overflow → `PAYLOAD_TOO_LARGE` on `query`; preview uses `truncate` then degrades.

Never trust publisher `format` (74k empty). Detector sniffs magic bytes when metadata is missing or contradictory (`sniff.ts`).

## Tests

- Offline: `pnpm exec vitest run tests/unit/formats`
- Live walk (15 catalog IDs, never throws): `DATAGOUV_LIVE=1 pnpm exec vitest run tests/unit/formats/live-walk.test.ts`  
  (offline setup still mocks `fetch` unless the test replaces the dispatcher.)
