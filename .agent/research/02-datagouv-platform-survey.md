# data.gouv.fr Platform Survey (Live API Research)

**Research date:** 2026-09-03  
**User-Agent used:** `datagouv-mcp-research/0.1`  
**Scope:** Empirical survey of production APIs and related Etalab services for a TypeScript MCP rewrite.

---

## Executive summary

| Service | Base URL | Auth | Notes |
|---------|----------|------|-------|
| udata API v1 | `https://www.data.gouv.fr/api/1/` | Public read; write needs session/API token | Swagger: `/swagger.json` (163 paths, ~239 KB) |
| udata API v2 | `https://www.data.gouv.fr/api/2/` | Same | Swagger: `/swagger.json` (23 paths, ~76 KB) |
| Tabular API | `https://tabular-api.data.gouv.fr/api/` | Public | OpenAPI at `/api/doc/swagger.json` (v0.3.3.dev0) |
| Metrics API | `https://metric-api.data.gouv.fr/api/` | Public | Tabular-style filters; no public OpenAPI found |
| Crawler/Hydra API | `https://crawler.data.gouv.fr/api/` | Public | Hydra pipeline; exceptions list for large tabular files |
| Explore (preview UI) | `https://explore.data.gouv.fr/` | Public | Per-resource preview URLs |
| Schema catalog | `https://schema.data.gouv.fr/` | Public | 95 schemas in `schemas.json` |
| Validata | `https://api.validata.etalab.studio/` | Public | `GET /validate` |

**Site scale (live `/api/1/site/`, 2026-09-03):** 74,200 datasets, 1,235 dataservices, 17,574 discussions, 503 harvesters, 6,550 reuses (from dedicated endpoints).

**Catalog export scale:** Resource export CSV dated `20260903-060151` contains **688,376** resources (semicolon-delimited).

---

## 1. API v1 (`https://www.data.gouv.fr/api/1/`)

**Swagger:** https://www.data.gouv.fr/api/1/swagger.json  
**Base path:** `/api/1`  
**Content-Type:** `application/json` (consumes/produces JSON)

### 1.1 Common list response shape

Most paginated list endpoints return:

```json
{
  "data": [ /* objects */ ],
  "page": 1,
  "page_size": 100,
  "total": 74202,
  "next_page": "https://www.data.gouv.fr/api/1/datasets/?page=2&page_size=100",
  "previous_page": null
}
```

**Observed pagination limits:**
- `page_size=1000` → HTTP 200, returns 1000 items (tested on `/datasets/`)
- `page_size=10000` → HTTP **502** Bad Gateway
- Default appears to be 20; max practical **1000** per page

**Caching headers (datasets list):** `cache-control: public`, `pragma: public`. No `ETag` or `Last-Modified` observed on list endpoints. No `X-RateLimit-*` headers observed.

### 1.2 `GET /datasets/` — search & filter

**URL:** `https://www.data.gouv.fr/api/1/datasets/`

**Query parameters** (from swagger + live tests):

| Parameter | Type | Example | Live `total` (2026-09-03) |
|-----------|------|---------|---------------------------|
| `q` | string | `radar` | 36 |
| `tag` | array | `insee` | 187 |
| `organization` | string (org **id**, not slug) | `61937d50e54eade2bbf8e8df` (INSEE) | 1 |
| `license` | string | `fr-lo` | 9,087 |
| `format` | string | `csv` | 26,878 datasets *having* a CSV resource |
| `geozone` | string | `country:fr` | 4,243 |
| `granularity` | string | `other` | 36,141 |
| `temporal_coverage` | string (interval) | `2020-01-01/2020-12-31` | 580 |
| `featured` | boolean | `true` | 675 |
| `badge` | string | `hvd` | 718 (High Value Datasets) |
| `sort` | string | `-created` | 74,202 (unfiltered) |
| `page` | integer | `1` | — |
| `page_size` | integer | `100` | — |
| `schema` | string | — | swagger only |
| `schema_version` | string | — | swagger only |
| `topic` | string | — | swagger only |
| `access_type` | string | — | swagger only |
| `organization_badge` | string | — | swagger only |
| `owner` | string | — | swagger only |
| `followed_by` | string | — | swagger only |
| `credit` | string | — | swagger only |
| `dataservice` | string | — | swagger only |
| `reuse` | string | — | swagger only |
| `archived` / `deleted` / `private` | boolean | — | swagger only |

**Note:** `format` filters **datasets** that contain at least one resource with that format — not individual resources. For resource-level counts use the catalog export (see §8).

**Single dataset:** `GET /datasets/{dataset}/` where `{dataset}` is id or slug.

**Example:** `https://www.data.gouv.fr/api/1/datasets/53699d0ea3a729239d205b2e/` (Population, INSEE)

**Key dataset fields:** `id`, `slug`, `title`, `description`, `organization`, `owner`, `tags`, `license`, `frequency`, `temporal_coverage`, `spatial`, `resources[]`, `community_resources[]`, `extras`, `metrics`, `quality`, `harvest`, `badges`, `schema`, `featured`, `archived`, `access_type`, `contact_points`, `permissions`.

### 1.3 Resources

| Endpoint | Behavior |
|----------|----------|
| `GET /datasets/{dataset}/resources/` | List resources on a dataset |
| `GET /datasets/{dataset}/resources/{rid}/` | Single resource metadata |
| `GET /datasets/r/{id}` | **302 redirect** to latest file URL (or remote URL) |
| `GET /datasets/{dataset}/resources/{rid}/upload/` | Upload (auth required) |

**Redirect example (live):**
```
GET https://www.data.gouv.fr/api/1/datasets/r/52200d61-5e80-4a4e-999f-6e1c184fa122
→ 302 Location: https://static.data.gouv.fr/resources/.../opendata-vitesses-...csv
```

**Resource object key fields:** `id` (UUID), `title`, `description`, `url`, `latest` (stable redirect URL), `format`, `mime`, `filesize`, `checksum`, `filetype` (`file`|`remote`), `type` (`main`|`documentation`|`api`|`code`|`update`|`other`), `created_at`, `last_modified`, `preview_url`, `schema`, `harvest`, `extras`, `metrics`.

**`latest` vs `url`:** `url` is the canonical source; `latest` is `https://www.data.gouv.fr/api/1/datasets/r/{rid}` — always resolves to current static file for hosted resources.

### 1.4 API v2 resource endpoint

`GET https://www.data.gouv.fr/api/2/datasets/resources/{rid}/`

**Response shape:**
```json
{
  "resource": { /* full resource object */ },
  "dataset_id": "619f8727e07d975a56664c61"
}
```

Preferred for MCP: includes nested `extras`, `preview_url`, and `dataset_id` in one call.

### 1.5 Organizations

| Endpoint | Notes |
|----------|-------|
| `GET /organizations/` | Paginated list |
| `GET /organizations/{org}/` | `{org}` = id or slug (e.g. `etalab` → id `534fff75a3a7292c64a77de4`) |
| `GET /organizations/suggest/?q=etalab&size=2` | Autocomplete |
| `GET /organizations/{org}/datasets/` | Org datasets |

### 1.6 Reuses

`GET /reuses/?page_size=1` → **total: 6,550**

Fields: `id`, `title`, `slug`, `url`, `type`, `theme`, `tags`, `datasets[]`, `dataservices[]`, `organization`, `metrics`, `badges`.

### 1.7 Users

`GET /users/suggest/?q=etalab&size=2` — returns `id`, `slug`, `first_name`, `last_name`, `email` (masked), `avatar_url`.

`GET /me/` without auth → **401** with message requiring credentials. Write endpoints (`/me/api_tokens/`, uploads) require authenticated session or API token (`Authorization: Bearer` or cookie).

### 1.8 Dataservices (third-party APIs catalog)

`GET /dataservices/?page_size=1` → **total: 1,235**

**Key fields:** `id`, `title`, `description`, `base_api_url`, `machine_documentation_url` (OpenAPI/Swagger URL), `business_documentation_url`, `availability`, `access_type`, `license`, `tags`, `datasets[]`, `badges`, `technical_groups`, `rate_limiting`, `extras`.

**Example with OpenAPI (v2 search):**
- API Adresse: id `672cf67802ef6b1be63b8975`, `machine_documentation_url`: `https://data.geopf.fr/geocodage/openapi.yaml`, `base_api_url`: `https://data.geopf.fr/geocodage/`

### 1.9 Topics

API v2: `GET /topics/?page_size=2`, `GET /topics/search/`, `GET /topics/{topic}/`, `GET /topics/{topic}/elements/`.

Topics are curated collections (e.g. "Inoé" topic by DINUM) with `name`, `slug`, `description`, `tags`, `elements[]`.

### 1.10 Spatial metadata

| Endpoint | Result |
|----------|--------|
| `GET /spatial/granularities/` | List: `country`, `fr:region`, `fr:departement`, `fr:commune`, etc. |
| `GET /spatial/levels/` | Same granularity ids with French labels |
| `GET /spatial/zones/suggest/?q=france&size=3` | Returns `[{id, code, name, level, uri}]` e.g. `country:fr` |
| `GET /spatial/zones/?q=france` | **404** — use `suggest` instead |

**Geozone filter example:** `geozone=country:fr` → 4,243 datasets.

### 1.11 Site & metrics

| Endpoint | Notes |
|----------|-------|
| `GET /site/` | Site metadata + aggregate metrics (datasets/month, visits/month, etc.) |
| `GET /site/catalog` | **302** → `/site/catalog.xml?page=1&page_size=100` (DCAT RDF/XML) |
| `GET /site/metrics/` | **404** (use `/site/` instead) |

**`/site/` excerpt (2026-09-03):** `"datasets": 74200`, `"dataservices": 1235`, `"discussions": 17574`.

### 1.12 Licenses

`GET /datasets/licenses/` → 12 license objects with `id`, `title`, `url`, `flags` (e.g. `okd_compliant`).

### 1.13 Tags autocomplete

- `GET /tags/suggest/?q=tran&size=5` → `[{"text": "transport"}, ...]`
- `GET /tags/?page_size=3` → **404** (no list endpoint at this path)

### 1.14 Discussions

`GET /discussions/?page_size=1` → **total: 17,575**

Fields: `id`, `title`, `subject` (dataset/reuse/etc.), `user`, `organization`, `discussion` (thread), `closed`, `url`, `self_web_url`.

API v2: `GET /discussions/search/`.

### 1.15 Harvest

| Endpoint | Notes |
|----------|-------|
| `GET /harvest/sources/?page_size=1` | **501** sources; fields: `id`, `name`, `url`, `backend`, `active` |
| `GET /harvest/backends/` | `ckan`, `csw-dcat`, `dcat`, etc. with filter configs |
| `GET /harvest/source/{source}/jobs/` | Job history |
| `GET /harvest/job/{ident}/items/` | Harvested items |

### 1.16 Schemas (data.gouv.fr registered schemas)

`GET /datasets/schemas/` → list of registered TableSchema/other schemas with `name` (e.g. `etalab/schema-bal`), `schema_url`, `versions[]`, `consolidation_dataset_id`.

### 1.17 Suggest endpoints

| Endpoint | Example |
|----------|---------|
| `GET /datasets/suggest/?q=popu&size=5` | Dataset cards with `id`, `slug`, `title`, `page` |
| `GET /datasets/suggest/formats/?q=cs&size=10` | `[{"text": "csv"}, {"text": "ics"}]` |
| `GET /datasets/suggest/mime/?q=text&size=5` | `[{"text": "text/csv"}, ...]` |

### 1.18 Badges (incl. HVD)

`GET /datasets/badges/`:
```json
{
  "hvd": "High value datasets",
  "inspire": "Inspire",
  "spd": "Reference data public service",
  "sr": "Statistical series of general interest"
}
```

Filter: `?badge=hvd` → 718 datasets.

### 1.19 Resource types

`GET /datasets/resource_types/` → `main`, `documentation`, `update`, `api`, `code`, `other` (with French labels).

---

## 2. API v2 (`https://www.data.gouv.fr/api/2/`)

**Swagger:** https://www.data.gouv.fr/api/2/swagger.json

### 2.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/datasets/` | List (subset of v1 filters) |
| GET | `/datasets/search/` | Full-text search with **facets** |
| GET | `/datasets/{dataset}/` | Dataset detail |
| GET | `/datasets/{dataset}/resources/` | Paginated resources |
| GET | `/datasets/{dataset}/resources/{rid}/extras/` | Resource extras only |
| GET | `/datasets/{dataset}/extras/` | Dataset extras |
| GET | `/datasets/{dataset}/schemas/` | Dataset schemas |
| GET | `/datasets/resources/{rid}/` | Resource + dataset_id |
| GET | `/dataservices/search/` | Dataservice search with facets |
| GET | `/organizations/search/` | Organization search |
| GET | `/organizations/{org}/extras/` | Org extras |
| GET | `/reuses/`, `/reuses/search/` | Reuses |
| GET | `/topics/`, `/topics/search/`, `/topics/{topic}/` | Topics |
| GET | `/discussions/search/` | Discussions |
| GET | `/posts/search/` | News posts |
| GET | `/captchetat/` | CAPTCHA (query params `get`, `c`, `t`) |

### 2.2 `GET /datasets/search/` — facets

**Example:** `?q=radar&page_size=1` → `total` + `facets`:

`format_family`, `access_type`, `producer_type`, `organization_id_with_name`, `last_update`, `tag`, `license`, `format`, `schema`, `geozone`, `granularity`, `badge`, `topics`

**Search response dataset** includes embedded `resources[]` (unlike v1 list which may omit them depending on endpoint).

### 2.3 Resources pagination (v2)

`GET /datasets/{dataset}/resources/?page=1&page_size=2`

Returns paginated `data[]` with full resource objects including `extras`, `preview_url`, `schema`, `internal`.

---

## 3. Tabular API (`https://tabular-api.data.gouv.fr/`)

**OpenAPI:** https://tabular-api.data.gouv.fr/api/doc/swagger.json  
**Version:** 0.3.3.dev0 (health endpoint, 2026-09-03)  
**Health:** `GET /health/` → `{"status":"ok","version":"0.3.3.dev0","uptime_since":"..."}`

### 3.1 Endpoints

| Path | Description |
|------|-------------|
| `GET /api/resources/{rid}/` | Metadata + HATEOAS links (`profile`, `data`, `swagger`) |
| `GET /api/resources/{rid}/profile/` | csv_detective profile (columns, types, encoding, separator, `total_lines`) |
| `GET /api/resources/{rid}/data/` | Paginated JSON rows |
| `GET /api/resources/{rid}/data/csv/` | Same filters, CSV output |
| `GET /api/resources/{rid}/data/json/` | JSON stream |
| `GET /api/resources/{rid}/swagger/` | **Per-resource OpenAPI (YAML)** with column-specific query params |
| `GET /api/aggregation-exceptions/` | Resources allowed to use aggregation operators |

### 3.2 Pagination limits

| `page_size` | Result |
|-------------|--------|
| 1–200 | OK |
| 500+ | HTTP 400: `"Page size exceeds allowed maximum: 200"` |

**Response meta:** `{"page":1,"page_size":100,"total":12788751}` (example: radar speeds 2023).

### 3.3 Filter operators (per-column, from per-resource swagger)

Applied as query params: `{column}__{operator}=value`

| Operator | Param suffix | Example |
|----------|--------------|---------|
| Exact match | `__exact` | `code_insee__exact=75056` |
| Differs | `__differs` | `date__differs=2020-01-01` |
| Contains (string) | `__contains` | `departement__contains=Paris` |
| In list | `__in` | `limite__in=50,90` |
| Less / greater | `__less`, `__greater` | numeric/date columns |
| Strictly less/greater | `__strictly_less`, `__strictly_greater` | numeric/date columns |
| Sort | `__sort` | `date__sort=asc` or `desc` |
| Group by | `__groupby` | aggregation (restricted) |
| Count | `__count` | aggregation |
| Avg / sum / min / max | `__avg`, `__sum`, `__min`, `__max` | numeric columns, aggregation |

**Aggregation policy:** `GET /api/aggregation-exceptions/` returns:
```json
{
  "allowed": ["b8703c69-a18f-46ab-9e7f-3a8368dcb891", ...],
  "exceptions": ["dddddddd-7777-eeee-8888-ffffffffffff", ...]
}
```
Only **7** production resource IDs in `allowed` (plus test UUIDs in `exceptions`). Aggregation is disabled by default for most resources.

### 3.4 Eligibility & size limits

**Eligible formats:** CSV and XLSX parsed by Hydra/csv-detective and loaded into the Tabular API database.

**Size limits (from existing Python MCP `crawler_api_client.py` comments, confirmed by platform behavior):**
- CSV: **100 MB** default max
- XLSX: **12.5 MB** default max
- **Exceptions:** resources listed at `https://crawler.data.gouv.fr/api/resources-exceptions` (2,287 entries as of 2026-09-03) bypass size limits

**Detection via resource `extras` (Hydra analysis):**

| Extra key | Meaning |
|-----------|---------|
| `analysis:parsing:started_at` | Parsing began |
| `analysis:parsing:finished_at` | Parsing succeeded |
| `analysis:parsing:parsing_table` | Internal table hash — **strong signal Tabular API is available** |
| `analysis:parsing:parquet_url` | Converted Parquet URL |
| `analysis:parsing:parquet_size` | Parquet size in bytes |
| `analysis:parsing:geojson_url` | GeoJSON conversion (geo resources) |
| `analysis:parsing:pmtiles_url` | PMTiles for map preview |
| `analysis:parsing:error` | Parsing failure reason |
| `analysis:error` | e.g. `"File too large to download"` |
| `analysis:checksum`, `analysis:content-length`, `analysis:mime-type` | Source file analysis |

**Catalog stats (688,376 resources):** 58,720 have `analysis:parsing:parsing_table` (~8.5% of all resources; ~59% of CSV resources).

### 3.5 Example resources

| Resource ID | Tabular API | Notes |
|-------------|-------------|-------|
| `a86ebc34-a979-4d6c-8f2a-9710a43dca93` | ✅ 200 | CSV gentilés communes; `preview_url` set; 34,946 rows |
| `52200d61-5e80-4a4e-999f-6e1c184fa122` | ✅ 200 | Large CSV exception (12.7M rows); in crawler exceptions list |
| `45f3844f-0039-48ec-ade7-7dc8c429168b` | ✅ 200 | XLSX; `engine: openpyxl`, 880 rows |
| `dbab1fa5-b902-4586-81e0-6063a6f96ca9` | ❌ 404 | CSV without `parsing_table` in catalog |
| `4792c248-8b80-4524-8605-7d4213e49051` | ❌ 404 | Remote HTML link (INSEE), `check:available: false` |

### 3.6 CORS & caching (Tabular API)

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
cache-control: public
x-cache-status: MISS
```

No rate-limit headers observed.

---

## 4. Metrics API (`https://metric-api.data.gouv.fr/api/`)

No public OpenAPI/Swagger at common paths (all return 404). API is used via `{model}/data/` pattern.

### 4.1 Models & endpoints

| Model | Endpoint | Sample fields |
|-------|----------|---------------|
| `datasets` | `/api/datasets/data/` | `dataset_id`, `organization_id`, `metric_month`, `monthly_visit`, `monthly_download_resource` |
| `resources` | `/api/resources/data/` | `resource_id`, `dataset_id`, `metric_month`, `monthly_download_resource` |
| `organizations` | `/api/organizations/data/` | `organization_id`, `metric_month`, `monthly_visit_dataset`, `monthly_download_resource`, `monthly_visit_reuse`, `monthly_visit_dataservice` |
| `reuses` | `/api/reuses/data/` | `reuse_id`, `metric_month`, `monthly_visit` |
| `dataservices` | `/api/dataservices/data/` | `dataservice_id`, `metric_month`, `monthly_visit` |

**CSV export:** `/api/{model}/data/csv/`

### 4.2 Response shape

```json
{
  "data": [ /* records */ ],
  "links": {"next": "...", "prev": null},
  "meta": {"page": 1, "page_size": 2, "total": 4542464}
}
```

### 4.3 Filters (Tabular-style)

| Param | Example |
|-------|---------|
| `{id_field}__exact` | `dataset_id__exact=53699d0ea3a729239d205b2e` |
| `{id_field}__contains` | `dataset_id__contains=536` (works) |
| `metric_month__sort` | `desc` or `asc` |
| `page_size` | max **50** (per Python client) |

**Example:** Population dataset → 51 monthly records from 2022–2026.

**Time granularity:** only `metric_month` observed in production data.

---

## 5. Crawler / Hydra API (`https://crawler.data.gouv.fr/api/`)

Used by existing Python MCP (`helpers/crawler_api_client.py`, `helpers/env_config.py`).

| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /api/health` | 200 | `{"version":"2.13.2.dev1","environment":"hydra","csv_analysis":true,"csv_to_db":true,"db_to_parquet":true,"db_to_geojson":true,"geojson_to_pmtiles":true,"parquet_to_db":true}` |
| `GET /api/resources-exceptions` | 200 | Array of `{id, resource_id, table_indexes, comment}` — **2,287** entries |
| `GET /api/resources` | 405 | Method not allowed |
| `GET /api/checks` | 405 | Method not allowed |

**Demo environment:** `https://demo-crawler.data.gouv.fr/api/`

---

## 6. Explore, preview & converted files

### 6.1 Explore UI

- Base: `https://explore.data.gouv.fr/`
- Per-resource preview: `https://explore.data.gouv.fr/fr/resources/{rid}`
- Example: `https://explore.data.gouv.fr/fr/resources/a86ebc34-a979-4d6c-8f2a-9710a43dca93`

Set in API as `resource.preview_url` when Hydra has parsed the resource.

### 6.2 Parquet URL patterns (Hydra conversions)

Two storage backends observed in `analysis:parsing:parquet_url`:

1. **Legacy OVH bucket:** `https://hydra.s3.rbx.io.cloud.ovh.net/parquet/{rid}.parquet`
2. **Object storage (current):** `https://object.files.data.gouv.fr/hydra-parquet/hydra-parquet/{rid}.parquet`

**Live test:** `HEAD` on `https://object.files.data.gouv.fr/hydra-parquet/hydra-parquet/84719f62-cdd4-4d7c-b292-2aafa56c6043.parquet` → 200, `ETag`, `Last-Modified`, `Content-Type: application/octet-stream`.

**Other Hydra outputs:**
- GeoJSON: `https://hydra.s3.rbx.io.cloud.ovh.net/geojson/{rid}.geojson`
- PMTiles: `https://hydra.s3.rbx.io.cloud.ovh.net/pmtiles/{uuid}.pmtiles`

### 6.3 Static file hosting

Hosted files: `https://static.data.gouv.fr/resources/{dataset-slug}/{timestamp}/{filename}`

---

## 7. Catalog exports ("Catalogue des données de data.gouv.fr")

**Dataset:** id `5d13a8b6634f41070a43dff3`, slug `catalogue-des-donnees-de-data-gouv-fr`  
**Updated daily** (observed 2026-09-03 05:51–06:09 UTC).

| Resource | Format | Example URL |
|----------|--------|-------------|
| export-dataset | CSV | `https://static.data.gouv.fr/resources/catalogue-des-donnees-de-data-gouv-fr/20260903-055132/export-dataset-20260903-055132.csv` |
| export-resource | CSV | `.../20260903-060151/export-resource-20260903-060151.csv` (688,376 rows) |
| export-organization | CSV | `.../export-organization-...csv` |
| export-dataservice | CSV | `.../export-dataservice-...csv` |
| export-reuse | CSV | `.../export-reuse-...csv` |
| export-harvest | CSV | `.../export-harvest-...csv` |
| export-discussion | CSV | `.../export-discussion-...csv` |
| export-tag | CSV | `.../export-tag-...csv` |

**Delimiter:** semicolon (`;`). **No Parquet catalog export** observed in current resources (CSV only).

### 7.1 DCAT catalog (RDF)

`GET https://www.data.gouv.fr/api/1/site/catalog` → 302 to `catalog.xml?page=1&page_size=100` (DCAT RDF/XML, includes datasets and dataservices).

### 7.2 Site CSV exports (disallowed in robots.txt)

`robots.txt` disallows `/datasets.csv`, `/resources.csv`, `/organizations.csv` etc. — front-end export routes exist but should not be scraped aggressively.

---

## 8. schema.data.gouv.fr

**Catalog:** https://schema.data.gouv.fr/schemas/schemas.json

```json
{
  "$schema": "...",
  "version": "...",
  "schemas": [ /* 95 schemas */ ]
}
```

Each schema entry includes `name` (e.g. `etalab/schema-bal`), `title`, `schema_type` (`tableschema`, `jsonschema`, `other`), `schema_url`, `versions[]`.

**Example schema file:** https://schema.data.gouv.fr/schemas/etalab/schema-bal/latest/schema.yml (TableSchema YAML, v1.5.0)

**Validation API (Validata):** https://api.validata.etalab.studio/

| Endpoint | Method | Params |
|----------|--------|--------|
| `/validate` | GET | `schema` (URL, required), `url` (tabular file URL, required), `ignore_header_case` (bool), `include_resource_data` (bool) |

OpenAPI spec: https://api.validata.etalab.studio/apispec_1.json  
Docs UI: https://api.validata.etalab.studio/apidocs

Validation results also appear in resource `extras` as `validation-report:*` keys (see formats catalog doc).

---

## 9. Rate limits, CORS, caching, robots

### 9.1 Rate limits

**No `X-RateLimit-*` headers** observed on:
- `www.data.gouv.fr/api/1/`
- `tabular-api.data.gouv.fr`
- `metric-api.data.gouv.fr`

Some **remote resources** checked by Hydra expose rate-limit headers in `check:cors:expose-headers` (e.g. ODS Explore APIs). This is metadata about the remote host, not data.gouv.fr itself.

**Practical guidance for MCP:** use conservative concurrency (≤5 parallel), honor 429/503 with backoff, always set a descriptive User-Agent.

### 9.2 CORS

| API | CORS |
|-----|------|
| Tabular API | `Access-Control-Allow-Origin: *` |
| Validata | `Access-Control-Allow-Origin: *` |
| udata API v1/v2 | No `Access-Control-Allow-Origin` on API responses (server-side MCP is fine) |

### 9.3 Caching

- udata list endpoints: `cache-control: public`
- Parquet objects: `ETag`, `Last-Modified`, `Accept-Ranges: bytes`
- Tabular API: `x-cache-status: MISS/HIT` (CDN)

### 9.4 robots.txt (excerpt)

```
User-agent: *
Disallow: /admin
Disallow: /datasets/search?*
Disallow: /datasets.csv
Disallow: /resources.csv
...
```

API endpoints under `/api/` are not disallowed. Avoid hammering front-end search and CSV export routes.

---

## 10. Related Etalab / French public APIs (optional MCP tools)

| API | Base URL | Status (2026-09-03) | Relevance |
|-----|----------|---------------------|-----------|
| API Géo | https://geo.api.gouv.fr/ | 200 | Communes, départements, regions, COG codes |
| Découpage administratif | https://geo.api.gouv.fr/decoupage-administratif/communes | 200 | Administrative boundaries |
| API Adresse (BAN) | https://api-adresse.data.gouv.fr/search/ | 200 (root 404) | Geocoding; also as dataservice with OpenAPI on geopf |
| API Recherche Entreprises | https://recherche-entreprises.api.gouv.fr/ | 301 | Company search (SIREN, dirigeants) |
| API Entreprise | https://entreprise.api.gouv.fr/ | (not probed) | Administrative data for companies |
| API Sirene (INSEE) | https://api.insee.fr/ | timeout/000 | Company registry (requires OAuth) |
| API Carto / Cadastre | https://apicarto.ign.fr/api/cadastre/ | 404 (path) | Parcels, cadastre — use API Carto dataservices |
| DVF (cquest) | https://api.cquest.org/dvf | 502 | Property transactions (unofficial mirror) |
| API GeoPF (IGN) | https://data.geopf.fr/ | (via dataservices) | WFS, geocoding, tiles |
| API Découpage (alternative) | https://geo.api.gouv.fr/ | — | Same as API Géo |

---

## 11. Test fixtures (real IDs from live platform)

| Entity | ID / URL |
|--------|----------|
| Dataset (Population) | `53699d0ea3a729239d205b2e` |
| Dataset (Catalog) | `5d13a8b6634f41070a43dff3` |
| Dataset (radar speeds) | `619f8727e07d975a56664c61` |
| Resource (tabular CSV) | `a86ebc34-a979-4d6c-8f2a-9710a43dca93` |
| Resource (large tabular CSV) | `52200d61-5e80-4a4e-999f-6e1c184fa122` |
| Resource (tabular XLSX) | `45f3844f-0039-48ec-ade7-7dc8c429168b` |
| Resource (non-tabular CSV) | `dbab1fa5-b902-4586-81e0-6063a6f96ca9` |
| Resource (dead remote HTML) | `4792c248-8b80-4524-8605-7d4213e49051` |
| Resource (parquet object.files) | `84719f62-cdd4-4d7c-b292-2aafa56c6043` |
| Organization (Etalab) | `534fff75a3a7292c64a77de4` / slug `etalab` |
| Dataservice (API Adresse) | `672cf67802ef6b1be63b8975` |
| HVD badge filter | `?badge=hvd` → 718 datasets |

---

## 12. MCP implementation notes

1. **Prefer API v2** for search (`/datasets/search/` with facets) and resource detail (`/datasets/resources/{rid}/`).
2. **Tabular-first** for any resource with `analysis:parsing:parsing_table` or successful `/profile/` (200).
3. **Fall back to Parquet** (`analysis:parsing:parquet_url`) for analytics on large files when Tabular pagination is impractical.
4. **Use crawler exceptions** before telling users a large CSV/XLSX is unavailable.
5. **Never trust `format` alone** — 74,460 resources have empty format; many remotes have `check:available: false`.
6. **Stable download:** always use `latest` URL (`/api/1/datasets/r/{rid}`) for hosted files.
