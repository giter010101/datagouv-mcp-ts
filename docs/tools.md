# Tool reference

Every tool is read-only (`readOnlyHint`, `idempotentHint`, `openWorldHint` set; `destructiveHint`
false) and returns two things: a text block laid out like the legacy Python server, and
`structuredContent` — a snake_case JSON mirror of the same facts (`total`, `page`, `page_size`,
`has_next` for paginated tools). Text is soft-capped by `MAX_OUTPUT_CHARS` (explicit
`[Output truncated…]` notice + `text_truncated: true`).

Failures are returned as results, not protocol errors:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error [NOT_FOUND]: Dataset with ID 'x' not found.\nHint: check the id with search_datasets." }],
  "structuredContent": { "error": { "code": "NOT_FOUND", "message": "…", "hint": "…", "retryable": false } }
}
```

Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `API_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`,
`FORMAT_ERROR`, `RESOURCE_UNAVAILABLE`, `UNSUPPORTED_CAPABILITY`, `PAYLOAD_TOO_LARGE`,
`ENGINE_UNAVAILABLE`, `INTERNAL_ERROR` ([architecture.md](architecture.md#cross-cutting-policies)).

Recommended workflows:

- **Find and read data**: `search_datasets` → `list_dataset_resources` (or `get_dataset_resources_summary`)
  → `get_resource_info` → `query_resource_data` (Tabular API) / `preview_resource` / `query_resource`.
- **Third-party APIs**: `search_dataservices` → `get_dataservice_info` → `get_dataservice_openapi_spec` → call `base_api_url` yourself.
- **Usage**: `get_metrics` (production platform only).

The parameter tables below are generated from the Zod input schemas in `src/tools/*.ts`
(descriptions are exactly what the LLM sees). "Registered" means present in `ALL_TOOLS`
(`src/tools/index.ts`) and therefore exposed by the server. The README catalogue is generated
with `tsx scripts/print-tool-catalog.ts`. Regenerate this page with `pnpm docs:tools`
(`docs/generate-tools-reference.mts`) after changing a tool. Legacy names, parameters,
defaults and clamps are frozen ([ADR 0007](../.agent/decisions/0007-tool-naming-and-compat.md)).

<!-- generated 2026-09-03 by docs/generate-tools-reference.mts — do not edit below this line -->

## Summary

| Tool | Title | Registered | Required parameters |
|------|-------|------------|---------------------|
| `search_datasets` | Search datasets | yes | `query` |
| `search_organizations` | Search organizations | yes | — |
| `search_dataservices` | Search third-party APIs | yes | `query` |
| `get_dataservice_info` | Get third-party API info | yes | `dataservice_id` |
| `get_dataservice_openapi_spec` | Get third-party API OpenAPI spec | yes | `dataservice_id` |
| `get_dataset_info` | Get dataset info | yes | `dataset_id` |
| `list_dataset_resources` | List dataset resources | yes | `dataset_id` |
| `get_resource_info` | Get resource info | yes | `resource_id` |
| `query_resource_data` | Query resource data | yes | `resource_id` |
| `get_metrics` | Get usage metrics | yes | — |
| `check_resource_availability` | Check resource availability | yes | `resource_id` |
| `get_dataset_resources_summary` | Get dataset resources summary | yes | `dataset_id` |
| `get_resource_schema` | Get resource schema | yes | `resource_id` |
| `get_reuse_info` | Get reuse info | yes | `reuse_id` |
| `list_high_value_datasets` | List high value datasets (HVD) | yes | — |
| `list_topics` | List topics | yes | — |
| `get_topic` | Get topic | yes | `topic_id` |
| `preview_resource` | Preview resource | yes | `resource_id` |
| `query_resource` | Query resource | yes | `resource_id` |
| `search_reuses` | Search reuses | yes | — |
| `suggest` | Suggest (autocomplete) | yes | `query` |

## Tools

### `search_datasets`

**Search datasets** — `src/tools/search-datasets.ts` (registered)

Search for datasets on data.gouv.fr by keywords.

This is typically the first step in exploring data.gouv.fr.
Use short, specific queries (the API uses AND logic, so generic words
like "données" or "fichier" may return zero results).

Use `sort` to order results. Accepted values: created, last_update,
reuses, followers, views. Optionally prefixed with '-' for descending
(e.g. -last_update). Use `last_update_range` to restrict
results to recently updated datasets: last_30_days, last_12_months,
last_3_years.

Optional facets narrow the search: organization, tag, license, format, badge (e.g. 'hvd'),
geozone, granularity, schema, topic. Facets are ANDed with the keywords.

Returns the total match count, the current page and for each dataset: title, ID,
short description, organization, tags, resource count and URL.
Typical workflow: search_datasets → get_dataset_resources_summary (or list_dataset_resources) → query_resource / preview_resource.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | — | Search keywords (short and specific; the API uses AND logic). |
| `page` | integer (≥ 1) | no | `1` | Page number (1-based). |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` | Results per page (max 100). |
| `sort` | string | no | — | Sort field: created, last_update, reuses, followers, views. Prefix with '-' for descending (e.g. -last_update). |
| `last_update_range` | `last_30_days` \| `last_12_months` \| `last_3_years` | no | — | Only datasets updated recently: last_30_days, last_12_months or last_3_years. |

### `search_organizations`

**Search organizations** — `src/tools/search-organizations.ts` (registered)

Find publishing organizations on data.gouv.fr (who publishes datasets and
reuses).

Pass a short `query` with distinctive words (acronym, ministry name, city,
"INSEE", etc.). Generic or very broad terms often return large result sets;
combine with `page` / `page_size` or add `badge` / `name` / `business_number_id`
when you need a narrow list.

Leave `query` empty to list organizations with pagination (same as browsing
the catalog). Use `sort` to order results (e.g. name, datasets, reuses,
followers, views, created, last_modified, or the same with a leading '-' for
descending, such as -datasets).

`badge` filters by publisher type: public-service, certified, association,
company, local-authority.

The reply includes how many organizations matched, the current page, and for
each hit: name (and acronym if any), id, slug, badges, optional usage
metrics, and links to the organization page.
Next step: pass the organization `id` as the `organization` facet of search_datasets.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | no | `""` | Keywords (acronym, ministry, city, 'INSEE'…). Empty string = browse the catalogue. |
| `page` | integer (≥ 1) | no | `1` | Page number (1-based). |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` | Results per page (max 100). |
| `sort` | string | no | — | Sort field: name, datasets, reuses, followers, views, created, last_modified; prefix with '-' for descending (e.g. -datasets). |
| `badge` | string | no | — | Publisher type: public-service, certified, association, company, local-authority. |
| `name` | string | no | — | Exact organization name filter. |
| `business_number_id` | string | no | — | SIREN / business identifier filter. |

### `search_dataservices`

**Search third-party APIs** — `src/tools/search-dataservices.ts` (registered)

Search for third-party APIs (dataservices) on data.gouv.fr by keywords.

Third-party APIs (or dataservices) are APIs registered in the data.gouv.fr catalog
that provide programmatic access to data (unlike datasets which are static files).
Use short, specific queries (the API uses AND logic, so generic words
like "données" or "fichier" may return zero results).

Returns for each API: title, ID, short description, organization, base API URL, tags, catalogue URL.
Typical workflow: search_dataservices → get_dataservice_info →
get_dataservice_openapi_spec → call the API using base_api_url per spec.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | — | Search keywords (short and specific; AND logic). |
| `page` | integer (≥ 1) | no | `1` | Page number (1-based). |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` | Results per page (max 100). |

### `get_dataservice_info`

**Get third-party API info** — `src/tools/get-dataservice-info.ts` (registered)

Get detailed metadata about a specific third-party API (dataservice).

Returns title, description, organization, base_api_url,
machine_documentation_url (OpenAPI/Swagger spec), license, and dates.

To use a third-party API: (1) get its info here, (2) fetch the OpenAPI spec
via get_dataservice_openapi_spec, (3) call base_api_url per spec.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataservice_id` | string | yes | — | Dataservice (third-party API) ID or slug. |

### `get_dataservice_openapi_spec`

**Get third-party API OpenAPI spec** — `src/tools/get-dataservice-openapi-spec.ts` (registered)

Fetch and summarize the OpenAPI/Swagger spec for a third-party API (dataservice).

Retrieves machine_documentation_url from catalog metadata (dataservice record),
fetches the spec, and returns a summary of available endpoints with
their parameters. Use this to understand how to call the API.
Response schemas, models and examples are omitted on purpose; servers are capped to 3
and endpoints to 150.

Typical workflow: search_dataservices → get_dataservice_info →
get_dataservice_openapi_spec → call the API using base_api_url per spec.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataservice_id` | string | yes | — | Dataservice (third-party API) ID or slug. |

### `get_dataset_info`

**Get dataset info** — `src/tools/get-dataset-info.ts` (registered)

Get detailed metadata about a specific dataset.

Returns title, description, organization, tags, resource count,
creation/update dates, and license information, plus badges (e.g. hvd),
update frequency, temporal/spatial coverage and the declared schema when present.
Accepts the dataset ID or its slug. To see the files themselves, call
get_dataset_resources_summary (recommended) or list_dataset_resources.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset_id` | string | yes | — | Dataset ID (24-hex) or slug. |

### `list_dataset_resources`

**List dataset resources** — `src/tools/list-dataset-resources.ts` (registered)

List all resources (files) in a dataset with their metadata.

Returns resource ID, title, format, size, and URL for each file, plus an `access_hint`
computed offline from the metadata (which capability applies and which tool to call next).
Next step: use query_resource / query_resource_data for tables served by the Tabular API,
preview_resource for any other format (JSON, GeoJSON, Parquet, PDF, archives…), or
get_resource_info for the full capability report of one resource.
For a ranked overview with a recommended starting resource, prefer get_dataset_resources_summary.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset_id` | string | yes | — | Dataset ID (24-hex) or slug. |
| `page` | integer (≥ 1) | no | `1` | Page of resources (only needed for datasets with more than 200 files). |
| `page_size` | integer (≥ 1, ≤ 200) | no | `200` | Resources per page (default and max 200). |

### `get_resource_info`

**Get resource info** — `src/tools/get-resource-info.ts` (registered)

Get detailed information about a specific resource (file).

Returns format, size, MIME type, URL, and checks Tabular API availability.
Helps decide whether to use query_resource_data (if Tabular API is available)
or fetch the raw file URL directly for unsupported formats or large files.

Also returns a full capability report: the detected format family, every applicable access
path (tabular_api, parquet, stream_parse, geo_preview, archive_inspect, document_preview,
api_endpoint, dead_link…), the platform's link-check result, and the recommended next tool
(query_resource, preview_resource, get_resource_schema…).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID (from list_dataset_resources). |

### `query_resource_data`

**Query resource data** — `src/tools/query-resource-data.ts` (registered)

Query tabular data from a resource via the Tabular API (no download needed).

Works for CSV/XLSX files. Start with small page_size (20) to preview structure.
Use filter_column/filter_value/filter_operator to filter, sort_column/sort_direction to sort.
Filter operators: exact, contains, less, greater, strictly_less, strictly_greater, differs, in.
For large datasets requiring full analysis, paginate through pages or use
get_resource_info to retrieve the raw file URL and fetch it directly.

Only resources indexed by the Tabular API work here (check with get_resource_info or
check_resource_availability). For other formats (JSON, GeoJSON, Parquet, XLSX too large, …)
use the format-agnostic query_resource / preview_resource tools instead.
Returns the total row count, the page, the column names and the rows (cells capped at 100 chars).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID (from list_dataset_resources). |
| `page` | integer (≥ 1) | no | `1` | Page number (1-based). |
| `page_size` | integer (≥ 1, ≤ 200) | no | `20` | Rows per page (1–200). Start with 20 to discover the columns. |
| `filter_column` | string | no | — | Column to filter on (exact name from the data). |
| `filter_value` | string | no | — | Filter value (required with filter_column). For operator 'in', separate values with commas. |
| `filter_operator` | string | no | `"exact"` | One of: exact, contains, less, greater, strictly_less, strictly_greater, differs, in. 'less'/'greater' are inclusive. |
| `sort_column` | string | no | — | Column to sort by. |
| `sort_direction` | string | no | `"asc"` | asc or desc. |

### `get_metrics`

**Get usage metrics** — `src/tools/get-metrics.ts` (registered)

Get usage metrics (visits, downloads) for a dataset or resource.

Returns monthly statistics sorted by most recent first.
At least one of dataset_id or resource_id must be provided.
`limit` is the number of months (default 12, max 100).
Note: Only available in production environment (not demo).
Datasets report visits and resource downloads; resources report downloads only.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset_id` | string | no | — | Dataset ID (24-hex). At least one of dataset_id / resource_id is required. |
| `resource_id` | string | no | — | Resource UUID. |
| `limit` | integer (≥ 1, ≤ 100) | no | `12` | Number of most recent months to return (1–100, default 12). |

### `check_resource_availability`

**Check resource availability** — `src/tools/check-resource-availability.ts` (registered)

Check whether a resource's file URL is actually reachable before spending calls on it.

Combines the platform's last crawler check (status, date, detected MIME, size — stored in
the resource metadata) with an optional live HEAD request (no body download). Useful because
many resources are remote links maintained by third parties and a large share suffer link rot.
Returns a verdict (available / unavailable / unknown), the HTTP status, content type, size,
last-modified date and a recommendation (which tool to call next, or to pick another resource).
Use it before preview_resource / query_resource on remote (`filetype: remote`) resources.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID. |
| `live` | boolean | no | `true` | Also send a HEAD request to the file URL now (default true). Set false to rely only on the platform's last crawler check. |

### `get_dataset_resources_summary`

**Get dataset resources summary** — `src/tools/get-dataset-resources-summary.ts` (registered)

One-call overview of a dataset and all its resources, with the best way to access each one.

Returns the dataset headline (title, publisher, license, last update, badges, declared schema),
resources grouped by format family (tabular, spreadsheet, json, geo, archive, document, api…)
with sizes and freshness, each resource's capability tier and recommended tool, and a single
`recommended` resource to start with (queryable main data preferred over documentation).
Detection is offline (metadata only, no probes) so it is fast; confirm with get_resource_info
before heavy queries. Cuts the search → list → info hop count: call it right after search_datasets.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dataset_id` | string | yes | — | Dataset ID (24-hex) or slug. |

### `get_resource_schema`

**Get resource schema** — `src/tools/get-resource-schema.ts` (registered)

Return the columns (name, type) and, when known, the row count of any queryable resource.

Sources, by preference: Tabular API profile, Parquet footer, inference from a bounded sample
of the file (CSV/XLSX/JSON…), or the schema.data.gouv.fr schema declared on the resource.
Call it before query_resource / query_resource_data to get exact column names for filters
and sorts. Not applicable to documents, archives, images or API endpoints (use preview_resource
or get_resource_info instead).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID. |

### `get_reuse_info`

**Get reuse info** — `src/tools/reuses.ts` (registered)

Get the details of one reuse: description, type, topic, tags, publisher and the list of
datasets it is built on (IDs usable with get_dataset_info / get_dataset_resources_summary).
Use search_reuses first to find the reuse ID or slug.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `reuse_id` | string | yes | — | Reuse ID or slug (from search_reuses). |

### `list_high_value_datasets`

**List high value datasets (HVD)** — `src/tools/list-high-value-datasets.ts` (registered)

Browse the High Value Datasets (HVD): datasets flagged under the EU Open Data Directive as
having the highest socio-economic value (geospatial, earth observation & environment,
meteorological, statistics, companies, mobility).

Optional keywords, thematic `category` and `organization` narrow the list. Equivalent to
search_datasets with badge='hvd'. Returns the same dataset summaries (ID, title, publisher,
tags, resource count, URL); continue with get_dataset_resources_summary.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | no | — | Optional keywords to search within HVD datasets. |
| `category` | `geospatial` \| `earth-observation-environment` \| `meteorological` \| `statistics` \| `companies` \| `mobility` | no | — | HVD thematic category: geospatial, earth-observation-environment, meteorological, statistics, companies, mobility. |
| `organization` | string | no | — | Organization ID facet. |
| `page` | integer (≥ 1) | no | `1` |  |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` |  |
| `sort` | string | no | — | Sort field (created, last_update, reuses, followers, views; '-' prefix = descending). |

### `list_topics`

**List topics** — `src/tools/topics.ts` (registered)

List curated topics (thematic collections of datasets and reuses maintained on data.gouv.fr),
optionally filtered by keywords.

Topics are the best entry point for broad themes (e.g. transport, energy, elections): call
get_topic to see the datasets a topic groups, or pass the topic ID as the `topic` facet of
search_datasets. Returns name, ID, slug, short description, tags and URL.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | no | `""` | Keywords to filter topics; empty lists all topics. |
| `page` | integer (≥ 1) | no | `1` |  |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` |  |

### `get_topic`

**Get topic** — `src/tools/topics.ts` (registered)

Get a topic (curated collection) with its description and the datasets it groups.

Returns the topic metadata and, for each dataset: title, ID, publisher, tags, resource count
and URL — ready for get_dataset_resources_summary. Large topics are capped to 100 datasets;
use search_datasets with the `topic` facet to page through all of them.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic_id` | string | yes | — | Topic ID or slug (from list_topics). |

### `preview_resource`

**Preview resource** — `src/tools/preview-resource.ts` (registered)

Safely look inside any resource, whatever its format, with hard size caps.

Routes by detected capability: first rows of a table (Tabular API, CSV/TSV, XLSX/ODS sheets,
JSON/JSONL, Parquet), feature count + bounding box + sample features for GeoJSON, entry
listing for archives (ZIP, Shapefile, GPKG), a text excerpt for documents (PDF/TXT/MD),
and metadata only for API endpoints or unknown binaries. Downloads are bounded
(MAX_DOWNLOAD_BYTES) and nothing is extracted from archives.
Use `member` to pick a sheet / layer / archive member. Then use query_resource for filters
and get_resource_schema for exact column types.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID. |
| `limit` | integer (≥ 1, ≤ 200) | no | `20` | Max rows / features / archive entries to return (default 20, max 200). For documents: characters ÷ 40. |
| `member` | string | no | — | Sub-table inside a container: XLSX sheet name, GPKG layer, or ZIP member. Omit to use the first / the listing. |

### `query_resource`

**Query resource** — `src/tools/query-resource.ts` (registered)

Query the rows of any tabular resource with filters, sort and pagination, whatever the format.

Routes automatically by detected capability: Tabular API (CSV/XLSX indexed by data.gouv.fr),
Parquet (native or converted), or a bounded in-process parse of CSV/TSV/XLSX/ODS/JSON/JSONL.
Same filter vocabulary as query_resource_data (exact, differs, contains, in, less, greater,
strictly_less, strictly_greater) but several filters and sort keys are allowed and columns can
be projected. Max 200 rows per call; paginate with `page`.

Aggregations (`group_by` + `aggregations`) and raw `sql` (single read-only SELECT over `data`)
need the optional DuckDB engine (ENABLE_DUCKDB=1); otherwise an ENGINE_UNAVAILABLE error tells
you to fall back to filters. Call get_resource_schema first for exact column names.
Not for documents/archives/APIs: use preview_resource there.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `resource_id` | string | yes | — | Resource UUID. |
| `filters` | array<object> (≤ 10 items) | no | — | Filters, ANDed together. |
| `sort` | array<object> (≤ 3 items) | no | — | Sort keys, in priority order. |
| `columns` | array<string> (≤ 50 items) | no | — | Only return these columns. |
| `page` | integer (≥ 1) | no | `1` | Page number (1-based). |
| `page_size` | integer (≥ 1, ≤ 200) | no | `20` | Rows per page (1–200). |
| `group_by` | array<string> (≤ 5 items) | no | — | Aggregate rows by these columns (requires the SQL engine, ENABLE_DUCKDB=1). Combine with `aggregations`. |
| `aggregations` | array<object> (≤ 10 items) | no | — | Aggregations to compute per group (count/sum/avg/min/max). Requires the SQL engine. |
| `sql` | string | no | — | Advanced: a single read-only SELECT over the table named `data` (e.g. SELECT dep, COUNT(*) n FROM data GROUP BY dep ORDER BY n DESC LIMIT 10). Requires ENABLE_DUCKDB=1; ignored filters/sort/page when set. |

### `search_reuses`

**Search reuses** — `src/tools/reuses.ts` (registered)

Find reuses — applications, visualisations, articles, APIs — built on data.gouv.fr datasets.

Search by keywords and/or restrict to the reuses of one dataset (`dataset_id`). Useful to see
how a dataset is used in practice, to find inspiration, or to ground an answer with existing
work. Returns title, type (application, visualization, api, post…), topic, organization,
number of datasets used and the reuse page URL. Then call get_reuse_info for details.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | no | — | Keywords. Omit to browse (optionally filtered by dataset_id). |
| `dataset_id` | string | no | — | Only reuses built on this dataset (ID or slug). |
| `page` | integer (≥ 1) | no | `1` |  |
| `page_size` | integer (≥ 1, ≤ 100) | no | `20` |  |

### `suggest`

**Suggest (autocomplete)** — `src/tools/suggest.ts` (registered)

Cheap autocomplete across datasets, organizations, tags, spatial zones and formats.

Use it to disambiguate a name before a full search (e.g. which 'INSEE' organization, the exact
tag slug, the geozone ID of a commune to pass as `geozone` to search_datasets). Returns for each
suggestion: kind, display text, ID and URL when available. Faster and cheaper than search_datasets;
results are prefix-based, not relevance-ranked.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | — | Prefix or partial name to autocomplete (2+ characters recommended). |
| `kind` | `dataset` \| `organization` \| `tag` \| `zone` \| `format` \| `all` | no | `"all"` | Restrict to one entity kind: dataset, organization, tag, zone (INSEE geozones), format. Default: all. |
| `size` | integer (≥ 1, ≤ 20) | no | `8` | Max suggestions per kind (1–20). |
