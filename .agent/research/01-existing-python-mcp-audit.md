# Existing Python MCP Server — Exhaustive Audit

**Repository:** `datagouv/datagouv-mcp`  
**Branch audited:** `cursor/datagouv-mcp-typescript-refonte-57e0`  
**Audit date:** 2026-09-03  
**Current version:** `0.2.30` (2026-07-17, per `CHANGELOG.md`; package version is dynamic via `setuptools-scm` from git tags)

---

## 1. Overview

### 1.1 Server startup

| Mode | Command | Notes |
|------|---------|-------|
| **Docker (recommended)** | `docker compose up -d` | Builds from `Dockerfile`, exposes `${MCP_PORT:-8000}` |
| **Manual** | `uv sync` then `uv run main.py` | Requires [uv](https://github.com/astral-sh/uv); load `.env` first |
| **Docker image entrypoint** | `uv run python main.py` | Base image: `astral/uv:python3.14-trixie-slim` |

Startup sequence in `main.py`:

1. `init_sentry()` — optional Sentry initialization
2. Create `FastMCP` instance with transport security and `stateless_http=True`
3. `register_tools(mcp)` — registers all 10 MCP tools
4. Wrap `mcp.streamable_http_app()` with `with_monitoring()` ASGI middleware (health + Matomo context)
5. Run via `uvicorn.run(asgi_app, host=MCP_HOST, port=MCP_PORT, ...)`

### 1.2 Framework and transport

| Aspect | Value |
|--------|-------|
| **Framework** | [FastMCP](https://github.com/modelcontextprotocol/python-sdk) (`mcp.server.fastmcp.FastMCP`) from official Python MCP SDK (`mcp>=1.25.0,<2`) |
| **Transport** | **Streamable HTTP only** — `mcp.streamable_http_app()` served by Uvicorn |
| **STDIO** | **Not supported** |
| **SSE** | **Not supported** |
| **Stateful sessions** | Disabled (`stateless_http=True`) to avoid "Session not found" errors with clients that don't maintain `mcp-session-id` |
| **DNS rebinding protection** | Enabled via `TransportSecuritySettings` (mcp ≥ 1.23) |
| **Allowed hosts** | `mcp.data.gouv.fr`, `mcp.preprod.data.gouv.fr`, `localhost:*`, `127.0.0.1:*` |
| **Allowed origins** | `https://mcp.data.gouv.fr`, `https://mcp.preprod.data.gouv.fr`, `http://localhost:*`, `http://127.0.0.1:*` |

### 1.3 HTTP endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | `POST` | JSON-RPC messages (Streamable HTTP MCP transport) |
| `/health` | `GET` | Deep health check — runs `search_datasets` in-process (no recursive HTTP) |

**There is no dedicated HTTP metrics/Prometheus endpoint.** Usage metrics are exposed only via the `get_metrics` MCP tool.

#### `/health` response

**200 OK** (healthy):

```json
{
  "status": "ok",
  "uptime_since": "<ISO8601 UTC>",
  "version": "<setuptools-scm version or 'unknown'>",
  "env": "<MCP_ENV or 'unknown'>",
  "data_env": "<DATAGOUV_API_ENV or 'unknown'>"
}
```

**503 Service Unavailable** (unhealthy):

```json
{
  "status": "mcp_unavailable"
}
```

Health probe logic (`helpers/health_probe.py`): calls `mcp.call_tool("search_datasets", {"query": "transport", "page_size": 1})` in-process; returns `True` only if response is non-empty `TextContent`. Matomo event overridden to `category=health_check`, `action=health_check`.

Docker Compose healthcheck: `GET http://localhost:{MCP_PORT}/health` every 60s.

### 1.4 Environment variables (complete table)

Sources: `helpers/env_config.py`, `helpers/sentry.py`, `helpers/matomo.py`, `helpers/logging.py`, `main.py`, `.env.example`, `docker-compose.yml`.

| Variable | Default | Set in `.env.example` | Purpose |
|----------|---------|----------------------|---------|
| `MCP_HOST` | `0.0.0.0` | `127.0.0.1` | Uvicorn bind host. Use `127.0.0.1` for local dev per MCP security guidance. |
| `MCP_PORT` | `8000` | `"8000"` | Uvicorn listen port; also used by `mcp_client`, stress tests, Docker port mapping. |
| `MCP_ENV` | `local` (Sentry); `unknown` (health JSON if unset) | `"local"` | Environment name sent to Sentry (`environment` field). Reported in `/health` as `env`. |
| `DATAGOUV_API_ENV` | `prod` | `"prod"` | Selects upstream API base URLs: `prod` or `demo`. Invalid values fall back to `prod`. |
| `LOG_LEVEL` | `INFO` | `"INFO"` | Python logging level for `logging.basicConfig` (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`). |
| `MATOMO_URL` | unset (disabled) | commented | Matomo instance base URL (e.g. `https://matomo.example.org`). Tracking disabled if unset or empty. |
| `MATOMO_SITE_ID` | unset (disabled) | commented | Matomo site ID. Both `MATOMO_URL` and `MATOMO_SITE_ID` required to enable tracking. |
| `MATOMO_AUTH_TOKEN` | unset | commented | Optional Matomo auth token; when set, enables `cip` (client IP) forwarding from `X-Forwarded-For`. |
| `SENTRY_DSN` | unset (disabled) | commented | Sentry DSN; monitoring disabled when unset. |
| `SENTRY_SAMPLE_RATE` | `1.0` | commented | Float `0.0`–`1.0` for Sentry traces and profiles sample rate. |

**Test-only variables** (not in `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `TEST_DATASET_ID` | `55e4129788ee386899a46ec1` | Integration test dataset ("Transports") |
| `TEST_RESOURCE_ID` / `RESOURCE_ID` | `3b6b2281-b9d9-4959-ae9d-c2c166dff118` | Integration test resource ("Élus locaux") |

**Not passed through `docker-compose.yml`:** `MCP_ENV`, `LOG_LEVEL`, `SENTRY_DSN`, `SENTRY_SAMPLE_RATE` (must be added manually if needed in Docker).

### 1.5 Upstream API base URLs (`env_config.py`)

| API key | `prod` | `demo` |
|---------|--------|--------|
| `datagouv_api` | `https://www.data.gouv.fr/api/` | `https://demo.data.gouv.fr/api/` |
| `site` | `https://www.data.gouv.fr/` | `https://demo.data.gouv.fr/` |
| `tabular_api` | `https://tabular-api.data.gouv.fr/api/` | `https://tabular-api.preprod.data.gouv.fr/api/` |
| `metrics_api` | `https://metric-api.data.gouv.fr/api/` | `https://metric-api.data.gouv.fr/api/` *(same — no demo)* |
| `crawler_api` | `https://crawler.data.gouv.fr/api/` | `https://demo-crawler.data.gouv.fr/api/` |

---

## 2. MCP Tools (complete inventory)

**Total: 10 tools.** All tools use `@log_tool` decorator (structured logging + async Matomo event) and `READ_ONLY_EXTERNAL_API_TOOL` annotations (`readOnlyHint=True`, `destructiveHint=False`, `idempotentHint=True`, `openWorldHint=True`).

**Removed tool (historical):** `download_and_parse_resource` — removed in v0.2.20. The TypeScript rewrite should **not** reintroduce it unless explicitly requested.

**Shared search behavior:** `search_datasets`, `search_organizations` (when query non-empty), and `search_dataservices` use `clean_search_query()` to strip French stop words (`données`, `fichier`, `csv`, etc.) because the API uses AND logic. If cleaned query returns zero results and differs from original, retries with original query.

---

### 2.1 `search_datasets`

| Field | Value |
|-------|-------|
| **Title** | `Search datasets` |
| **Return type** | `str` (plain text) |

**Description (verbatim docstring):**

> Search for datasets on data.gouv.fr by keywords.
>
> This is typically the first step in exploring data.gouv.fr.
> Use short, specific queries (the API uses AND logic, so generic words
> like "données" or "fichier" may return zero results).
>
> Use `sort` to order results. Accepted values: created, last_update,
> reuses, followers, views. Optionally prefixed with '-' for descending
> (e.g. -last_update). Use `last_update_range` to restrict
> results to recently updated datasets: last_30_days, last_12_months,
> last_3_years.
>
> Typical workflow: search_datasets → list_dataset_resources → query_resource_data.

**Parameters:**

| Name | Type | Default | Constraints | Description |
|------|------|---------|-------------|-------------|
| `query` | `str` | *(required)* | — | Search keywords |
| `page` | `int` | `1` | — | Page number |
| `page_size` | `int` | `20` | max 100 (API-side clamp in client) | Results per page |
| `sort` | `str \| None` | `None` | e.g. `created`, `-last_update` | Sort field |
| `last_update_range` | `str \| None` | `None` | `last_30_days`, `last_12_months`, `last_3_years` | Recency filter |

**Upstream API:**

- `GET {datagouv_api}2/datasets/search/`
- Query params: `q`, `page`, `page_size` (capped at 100), optional `sort`, `last_update_range`
- Timeout: 15s
- Header: `User-Agent: datagouv-mcp/{version}`

**Response shaping:**

- Header: `Found {total} dataset(s) for query: '{query}'` + `Page {page} of results:`
- Per dataset (numbered): title, ID, description_short (truncated to 200 chars + `...`), organization, tags (max 5), resources_count, URL
- Empty: `No datasets found for query: '{query}'`

**Error handling:** Errors from API propagate (not caught in tool layer).

**Pagination:** Pass-through `page` / `page_size`; total from API `total` field.

**Limitations:** AND-based search; stop-word cleaning may still yield zero results; `resources_count` from `resources.total` in API v2 response.

---

### 2.2 `search_organizations`

| Field | Value |
|-------|-------|
| **Title** | `Search organizations` |

**Description (verbatim docstring):**

> Find publishing organizations on data.gouv.fr (who publishes datasets and
> reuses).
>
> Pass a short `query` with distinctive words (acronym, ministry name, city,
> "INSEE", etc.). Generic or very broad terms often return large result sets;
> combine with `page` / `page_size` or add `badge` / `name` / `business_number_id`
> when you need a narrow list.
>
> Leave `query` empty to list organizations with pagination (same as browsing
> the catalog). Use `sort` to order results (e.g. name, datasets, reuses,
> followers, views, created, last_modified, or the same with a leading '-' for
> descending, such as -datasets).
>
> `badge` filters by publisher type: public-service, certified, association,
> company, local-authority.
>
> The reply includes how many organizations matched, the current page, and for
> each hit: name (and acronym if any), id, slug, badges, optional usage
> metrics, and links to the organization page.

**Parameters:**

| Name | Type | Default | Constraints | Description |
|------|------|---------|-------------|-------------|
| `query` | `str` | `""` | — | Keyword search; empty = browse |
| `page` | `int` | `1` | — | Page number |
| `page_size` | `int` | `20` | max 100 | Results per page |
| `sort` | `str \| None` | `None` | e.g. `name`, `-datasets` | Sort field |
| `badge` | `str \| None` | `None` | `public-service`, `certified`, `association`, `company`, `local-authority` | Publisher type filter |
| `name` | `str \| None` | `None` | — | Exact name filter |
| `business_number_id` | `str \| None` | `None` | — | SIREN / business id filter |

**Upstream API:**

- `GET {datagouv_api}2/organizations/search/`
- Params: `page`, `page_size` (max 100); optional `q`, `sort`, `badge`, `name`, `business_number_id` (empty `q` omitted)
- Timeout: 15s

**Response shaping:**

- Filter description built from active filters
- Per org: name (+ acronym), ID, slug, badges, metrics subset (`datasets`, `reuses`, `followers`, `views`), URL, profile URL if different
- Empty: `No organizations found for {label}`

**Error handling:** Uncaught API errors.

**Pagination:** Pass-through.

---

### 2.3 `get_dataset_info`

| Field | Value |
|-------|-------|
| **Title** | `Get dataset info` |

**Description (verbatim docstring):**

> Get detailed metadata about a specific dataset.
>
> Returns title, description, organization, tags, resource count,
> creation/update dates, and license information.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `dataset_id` | `str` | *(required)* | Dataset UUID or slug |

**Upstream API:**

- `GET {datagouv_api}1/datasets/{dataset_id}/`
- Timeout: 15s

**Response shaping:**

- Title, ID, slug, site URL (`{site}datasets/{slug}/`)
- `description_short`; full `description` truncated to 500 chars + `...` if different
- Organization name + ID
- Tags (max 10)
- Resource count (length of embedded `resources` array)
- `created_at`, `last_update`, `license`, `frequency`

**Error handling:**

- HTTP 404 → `Error: Dataset with ID '{dataset_id}' not found.`
- Other HTTP → `Error: HTTP {status} - {message}`
- Generic → `Error: {str(e)}`

---

### 2.4 `list_dataset_resources`

| Field | Value |
|-------|-------|
| **Title** | `List dataset resources` |

**Description (verbatim docstring):**

> List all resources (files) in a dataset with their metadata.
>
> Returns resource ID, title, format, size, and URL for each file.
> Next step: use query_resource_data for CSV/XLSX files via the Tabular API,
> or fetch the resource URL directly for other formats (JSON, JSONL) or large datasets.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `dataset_id` | `str` | *(required)* | Dataset ID |

**Upstream API:**

- `GET {datagouv_api}1/datasets/{dataset_id}/` (single call — no N+1)
- Timeout: 15s

**Response shaping:**

- Dataset title, ID, total count
- Per resource: title, resource ID, format, human-readable size (B/KB/MB/GB), MIME, type, URL
- Skips resources without `id`
- No resources: `This dataset has no resources.`
- Missing dataset: `Error: Dataset with ID '{dataset_id}' not found.`

**Error handling:** Generic `Error: {str(e)}` (no HTTP status specialization).

**Note:** Does not check Tabular API availability per resource (use `get_resource_info` for that).

---

### 2.5 `get_resource_info`

| Field | Value |
|-------|-------|
| **Title** | `Get resource info` |

**Description (verbatim docstring):**

> Get detailed information about a specific resource (file).
>
> Returns format, size, MIME type, URL, and checks Tabular API availability.
> Helps decide whether to use query_resource_data (if Tabular API is available)
> or fetch the raw file URL directly for unsupported formats or large files.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `resource_id` | `str` | *(required)* | Resource UUID |

**Upstream API calls:**

1. `GET {datagouv_api}2/datasets/resources/{resource_id}/` — resource details
2. `GET {datagouv_api}1/datasets/{dataset_id}/` — dataset title (via `get_dataset_metadata`, errors swallowed)
3. `GET {crawler_api}resources-exceptions` — exceptions list (cached 1h) via `is_in_exceptions_list`
4. `GET {tabular_api}resources/{resource_id}/profile/` — Tabular availability check (timeout 10s, ad-hoc `niquests.AsyncSession`, not shared client)

**Response shaping:**

- Resource title, ID, format, size (human-readable), MIME, type, URL, description
- Dataset ID + title
- Tabular API section:
  - `✅ Available via Tabular API (large file exception)` — profile 200 + in exceptions list
  - `✅ Available via Tabular API (can be queried)` — profile 200
  - `⚠️  Not available via Tabular API (may not be tabular data)` — non-200 profile
  - `⚠️  Could not check Tabular API availability` — exception during check

**Error handling:**

- Missing resource → `Error: Resource with ID '{resource_id}' not found.`
- HTTP errors → `Error: HTTP {status} - ...`
- Generic → `Error: {str(e)}`

---

### 2.6 `query_resource_data`

| Field | Value |
|-------|-------|
| **Title** | `Query resource data` |

**Description (verbatim docstring):**

> Query tabular data from a resource via the Tabular API (no download needed).
>
> Works for CSV/XLSX files. Start with small page_size (20) to preview structure.
> Use filter_column/filter_value/filter_operator to filter, sort_column/sort_direction to sort.
> Filter operators: exact, contains, less, greater, strictly_less, strictly_greater.
> For large datasets requiring full analysis, paginate through pages or use
> get_resource_info to retrieve the raw file URL and fetch it directly.

**Parameters:**

| Name | Type | Default | Constraints | Description |
|------|------|---------|-------------|-------------|
| `resource_id` | `str` | *(required)* | — | Resource UUID |
| `page` | `int` | `1` | ≥ 1 (API-side) | Page number |
| `page_size` | `int` | `20` | clamped 1–200 | Rows per page |
| `filter_column` | `str \| None` | `None` | — | Column to filter |
| `filter_value` | `str \| None` | `None` | — | Filter value (required with `filter_column`) |
| `filter_operator` | `str` | `"exact"` | see operators below | Filter operator |
| `sort_column` | `str \| None` | `None` | — | Column to sort |
| `sort_direction` | `str` | `"asc"` | `asc` or `desc` | Sort direction |

**Filter operators** (mapped to Tabular API query params):

| Tool value | API param suffix | Example param |
|------------|------------------|---------------|
| `exact` | `__exact` | `column__exact=value` |
| `contains` | `__contains` | `column__contains=value` |
| `less` | `__less` | `column__less=value` |
| `greater` | `__greater` | `column__greater=value` |
| `strictly_less` | `__strictly_less` | `column__strictly_less=value` |
| `strictly_greater` | `__strictly_greater` | `column__strictly_greater=value` |

**Sort:** `{sort_column}__sort={asc|desc}`

**Upstream API:**

- Metadata: `get_resource_metadata`, `get_dataset_metadata` (best-effort)
- Data: `GET {tabular_api}resources/{resource_id}/data/?page=&page_size=&{filters}`
- Timeout: 30s

**Response shaping:**

- Context header: resource title, ID, dataset title/ID
- Applied filter/sort lines
- `Total rows`, `Total pages`, `Retrieved: N row(s) from page X`
- Column names from first row
- All rows printed; cell values truncated to 100 chars + `...`
- Empty rows: `⚠️  No rows available (resource may be empty or filtered).`
- Pagination hint:
  - `total > 1000`: large dataset warning + paginate or use raw URL
  - else: `📄 More data available. Use page={next} to see the next page.`

**Error handling (in-band, not raised to MCP client):**

- Invalid `filter_operator` → `Error: invalid filter_operator. Supported values: ...`
- Invalid `sort_direction` → `Error: invalid sort_direction. Supported values: asc, desc.`
- `ResourceNotAvailableError` → `⚠️  {MSG_RESOURCE_NOT_IN_TABULAR}`
- `TabularApiRequestError` → `⚠️  {LLM-friendly message}`
- `niquests.HTTPError` → `❌ Tabular API error (HTTP {status}: ...)`
- Other → `❌ Error querying resource: ...`

**Pagination:** `page` + `page_size`; uses `links.next` only for hint text.

**Limitations:**

- Only CSV/XLSX within Tabular API size limits (CSV ≤ 100 MB, XLSX ≤ 12.5 MB) or exceptions list
- No support for JSON, JSONL, GeoJSON, Parquet, etc. via this tool
- `question` parameter was removed in v0.2.24
- README workflow note: preview with `page_size=20`; paginate or fetch raw URL for large data

---

### 2.7 `search_dataservices`

| Field | Value |
|-------|-------|
| **Title** | `Search third-party APIs` |

**Description (verbatim docstring):**

> Search for third-party APIs (dataservices) on data.gouv.fr by keywords.
>
> Third-party APIs (or dataservices) are APIs registered in the data.gouv.fr catalog
> that provide programmatic access to data (unlike datasets which are static files).
> Use short, specific queries (the API uses AND logic, so generic words
> like "données" or "fichier" may return zero results).
>
> Typical workflow: search_dataservices → get_dataservice_info →
> get_dataservice_openapi_spec → call the API using base_api_url per spec.

**Parameters:**

| Name | Type | Default | Constraints |
|------|------|---------|-------------|
| `query` | `str` | *(required)* | — |
| `page` | `int` | `1` | — |
| `page_size` | `int` | `20` | max 100 |

**Upstream API:**

- `GET {datagouv_api}2/dataservices/search/?q=&page=&page_size=`
- Timeout: 15s

**Response shaping:** Similar to `search_datasets` but includes `base_api_url`; empty message: `No third-party APIs found for query: '{query}'`

---

### 2.8 `get_dataservice_info`

| Field | Value |
|-------|-------|
| **Title** | `Get third-party API info` |

**Description (verbatim docstring):**

> Get detailed metadata about a specific third-party API (dataservice).
>
> Returns title, description, organization, base_api_url,
> machine_documentation_url (OpenAPI/Swagger spec), license, and dates.
>
> To use a third-party API: (1) get its info here, (2) fetch the OpenAPI spec
> via get_dataservice_openapi_spec, (3) call base_api_url per spec.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| `dataservice_id` | `str` | *(required)* |

**Upstream API:**

- `GET {datagouv_api}1/dataservices/{dataservice_id}/`
- Timeout: 15s

**Response shaping:**

- Title, ID, site URL, description (500 chars + `...`)
- `base_api_url`, `machine_documentation_url`
- Organization, tags (max 10), dates, license
- Related datasets count from `datasets.total` link object

**Error handling:**

- 404 → `Error: Third-party API not found (dataservice_id='...').`
- Other HTTP / generic errors

---

### 2.9 `get_dataservice_openapi_spec`

| Field | Value |
|-------|-------|
| **Title** | `Get third-party API OpenAPI spec` |

**Description (verbatim docstring):**

> Fetch and summarize the OpenAPI/Swagger specification for a third-party API (dataservice).
>
> Retrieves machine_documentation_url from catalog metadata (dataservice record),
> fetches the spec, and returns a summary of available endpoints with
> their parameters. Use this to understand how to call the API.
>
> Typical workflow: search_dataservices → get_dataservice_info →
> get_dataservice_openapi_spec → call the API using base_api_url per spec.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| `dataservice_id` | `str` | *(required)* |

**Upstream API calls:**

1. `GET {datagouv_api}1/dataservices/{dataservice_id}/` — get `machine_documentation_url`
2. `GET {machine_documentation_url}` — fetch spec (JSON or YAML, redirects allowed, timeout 15s)

**Response shaping (`_summarize_spec`):**

- API info: title, version, description (300 chars + `...`)
- Servers (max 3) or Swagger 2.0 `host`/`basePath`
- Endpoints: method, path, summary (120 chars), parameters (`name [location, type] (required)`)
- Skips: response schemas, model definitions, examples

**Error handling:**

- No `machine_documentation_url` → informative message (includes `base_api_url` if present)
- 404 on dataservice → not found error
- Fetch/parse failure → `Error fetching OpenAPI spec: ...`

---

### 2.10 `get_metrics`

| Field | Value |
|-------|-------|
| **Title** | `Get usage metrics` |

**Description (verbatim docstring):**

> Get usage metrics (visits, downloads) for a dataset or resource.
>
> Returns monthly statistics sorted by most recent first.
> At least one of dataset_id or resource_id must be provided.
> Note: Only available in production environment (not demo).

**Parameters:**

| Name | Type | Default | Constraints |
|------|------|---------|-------------|
| `dataset_id` | `str \| None` | `None` | At least one of `dataset_id` or `resource_id` required |
| `resource_id` | `str \| None` | `None` | — |
| `limit` | `int` | `12` | clamped 1–50 *(README says max 100 — **code uses 50**)* |

**Upstream API:**

- `GET {metrics_api}datasets/data/` or `resources/data/`
- Params: `{model}_id__exact`, `metric_month__sort=desc`, `page_size` (max 50)
- Timeout: 20s
- Metadata context from datagouv API (best-effort)

**Environment guard:** If `DATAGOUV_API_ENV=demo`, returns error message explaining Metrics API is prod-only.

**Response shaping:**

- Dataset section: table with Month, Visits, Downloads + totals
- Resource section: table with Month, Downloads + totals
- Handles `None` metric values as 0
- Both sections rendered if both IDs provided

**Error handling:** In-band error strings; per-section try/except.

**Note:** `get_metrics_csv` exists in `metrics_api_client` but is **not** exposed as an MCP tool.

---

## 3. Helpers

### 3.1 `env_config`

- **Function:** `get_base_url(api_name: str) -> str`
- **Valid `api_name`:** `datagouv_api`, `site`, `tabular_api`, `metrics_api`, `crawler_api`
- **Env:** `DATAGOUV_API_ENV` (`demo`|`prod`, default `prod`)
- **Errors:** `KeyError` for invalid `api_name`

### 3.2 `datagouv_api_client`

| Function | Endpoint | Timeout | Notes |
|----------|----------|---------|-------|
| `get_dataset_details` | `GET 1/datasets/{id}/` | 15s | Full v1 payload |
| `get_dataset_metadata` | (wraps above) | 15s | Trimmed fields |
| `get_resource_details` | `GET 2/datasets/resources/{id}/` | 15s | v2 payload |
| `get_resource_metadata` | (wraps above) | 15s | id, title, description, dataset_id |
| `get_resource_and_dataset_metadata` | combined | 15s | — |
| `get_resources_for_dataset` | `GET 1/datasets/{id}/` | 15s | Returns id/title tuples |
| `search_datasets` | `GET 2/datasets/search/` | 15s | page_size max 100 |
| `search_organizations` | `GET 2/organizations/search/` | 15s | page_size max 100 |
| `search_dataservices` | `GET 2/dataservices/search/` | 15s | page_size max 100 |
| `get_dataservice_details` | `GET 1/dataservices/{id}/` | 15s | — |
| `fetch_openapi_spec` | arbitrary URL | 15s | JSON then YAML parse |

- **Headers:** `User-Agent: datagouv-mcp/{version}` on all requests
- **HTTP client:** `niquests.AsyncSession` (per-call or injected session)
- **Retry logic:** None
- **Caching:** None
- **Errors:** `niquests.HTTPError` logged and re-raised from `_fetch_json`

### 3.3 `tabular_api_client`

| Function | Endpoint | Timeout |
|----------|----------|---------|
| `fetch_resource_data` | `GET resources/{id}/data/` | 30s |
| `fetch_resource_profile` | `GET resources/{id}/profile/` | 30s |

**Standard query parameters:**

| Param | Description |
|-------|-------------|
| `page` | Page number (min 1) |
| `page_size` | Rows per page (min 1) |
| `{column}__exact` | Exact match |
| `{column}__contains` | Substring match |
| `{column}__less` | Less than or equal |
| `{column}__greater` | Greater than or equal |
| `{column}__strictly_less` | Strictly less than |
| `{column}__strictly_greater` | Strictly greater than |
| `{column}__sort` | `asc` or `desc` |

**Error classes:**

| Class | When raised |
|-------|-------------|
| `ResourceNotAvailableError` | HTTP 404 |
| `TabularApiRequestError` | HTTP ≥ 400 (except 404), 408, 429, 5xx; includes LLM-friendly messages |

**User-facing messages (constants):**

- `MSG_RESOURCE_NOT_IN_TABULAR` — 404 hint to use search → list resources
- `MSG_TABULAR_SERVER_ISSUE` — 5xx / 408 / 429
- `MSG_TABULAR_BAD_REQUEST` — 4xx with filter/sort guidance
- `MSG_TABULAR_COLUMN_HINT` — appended when error mentions "does not exist"

**Profile post-processing:** Strips surrounding `"` from header names.

**Retry / caching:** None.

### 3.4 `crawler_api_client`

| Function | Endpoint | Timeout |
|----------|----------|---------|
| `fetch_resource_exceptions` | `GET resources-exceptions` | 30s |
| `is_in_exceptions_list` | (uses cache) | — |

- **Caching:** In-memory set, TTL 3600s (1 hour)
- **On fetch failure:** Returns stale cache if available, else empty set
- **`clear_cache()`:** For tests

### 3.5 `metrics_api_client`

| Function | Endpoint | Timeout |
|----------|----------|---------|
| `get_metrics` | `GET {model}/data/` | 20s |
| `get_metrics_csv` | `GET {model}/data/csv/` | 30s |

**Query operators:**

| Param | Description |
|-------|-------------|
| `{id_field}__exact` | Filter by ID (auto: `dataset_id`, `resource_id`, etc.) |
| `metric_{granularity}__sort` | Sort by time (`asc`/`desc`, default `desc`) |
| `page_size` | Max records (clamped 1–50) |

**Supported models (in code):** `datasets`, `resources` (also documented: `organizations`, `reuses`)

**Errors:** `ValueError` for empty id; `niquests.HTTPError` on API failure

### 3.6 `mcp_client`

- `call_tool_on_mcp(tool_name, params)` — connects to `http://localhost:{MCP_PORT}/mcp` via streamable HTTP client
- Used by `scripts/call_tool.py` and could be used for integration tests

### 3.7 `mcp_tool_defaults`

```python
READ_ONLY_EXTERNAL_API_TOOL = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
```

### 3.8 `health_probe`

- `_run_health_check(mcp)` — in-process `search_datasets` with `query="transport"`, `page_size=1`
- Matomo override for health events
- Returns `bool`

### 3.9 `matomo`

- **Config:** `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN` (module-level, read at import)
- **Tracking endpoint:** `POST {MATOMO_URL}/matomo.php`
- **Default event category:** `tools`
- **Event action:** tool function name (e.g. `search_datasets`)
- **Shared client:** `niquests.AsyncSession(timeout=1.5)` — reused across requests
- **Request context** (per HTTP request via middleware): page URL (`https://{host}{path}`), User-Agent, client IP from `X-Forwarded-For`
- **Tool tracking:** `log_tool` decorator fires `asyncio.create_task(track_matomo_event(...))` — fire-and-forget
- **No tracking on `/mcp` itself** (only tool events) — per v0.2.28
- **Disabled when:** `MATOMO_URL` or `MATOMO_SITE_ID` unset/empty

### 3.10 `sentry`

- Init only if `SENTRY_DSN` set
- `environment=MCP_ENV` (default `local`)
- `traces_sample_rate` and `profiles_sample_rate` from `SENTRY_SAMPLE_RATE` (default `1.0`)
- `send_default_pii=False`

### 3.11 `logging`

- **Main logger:** `mcp.main`
- **Tools logger:** `mcp.tools`
- **Format:** `%(asctime)s | %(levelname)s | %(name)s | %(message)s`
- **Level:** `LOG_LEVEL` env (default `INFO`)
- **`log_tool` decorator:** Logs `Tool called: {name} | kwargs={kwargs}` at INFO; triggers Matomo event
- **Uvicorn config:** Same format, root level INFO

### 3.12 `user_agent`

```python
USER_AGENT = f"datagouv-mcp/{version('datagouv-mcp')}"
```

Used on all outbound data.gouv.fr service requests.

---

## 4. Observability

| System | Trigger | Data captured |
|--------|---------|---------------|
| **Structured logging** | All tool calls via `@log_tool` | Tool name + kwargs at INFO |
| **Matomo events** | Each tool call (async) | `e_c=tools`, `e_a={tool_name}`, URL, UA, optional CIP |
| **Sentry** | Unhandled exceptions (SDK auto-capture) | Errors + performance traces/profiles |
| **Health endpoint** | `GET /health` | In-process probe result + version/uptime/env |
| **Metrics MCP tool** | Client calls `get_metrics` | Dataset/resource visit & download stats from Metrics API |

**No Prometheus/OpenTelemetry/metrics HTTP endpoint exists.**

---

## 5. Tests

### 5.1 Runner configuration (`pyproject.toml`)

```ini
asyncio_mode = "auto"
addopts = "-m 'not stress and not health_check'"
markers:
  stress: requires running MCP server
  health_check: requires network + in-process probe
```

Default: `uv run pytest` (unit + integration against live APIs).

### 5.2 Test files

| File | Coverage | Live vs mocked |
|------|----------|----------------|
| `test_env_config.py` | All env/API URL combinations, invalid api_name | Unit (monkeypatch) |
| `test_datagouv_api.py` | All datagouv client functions, search params, org trimming, OpenAPI fetch | Mostly **live API**; some mocked (User-Agent, param forwarding, resources_count) |
| `test_tabular_api.py` | Profile, data, pagination, filters (`__exact`), sort (`__sort`), invalid resource | **Live Tabular API** (configurable `RESOURCE_ID`) |
| `test_tabular_api_client_errors.py` | 404, 502, 400 with column hints, non-JSON 400 | **Mocked** (`niquests-mock`) |
| `test_crawler_api.py` | Exceptions fetch + `is_in_exceptions_list` | **Live Crawler API** |
| `test_metrics_api.py` | get_metrics, get_metrics_csv, limit clamping, None handling, sort | **Live Metrics API** (prod) |
| `test_matomo.py` | Event fields, CIP forwarding, skip when disabled, override | **Mocked** |
| `test_tool_logging.py` | `@log_tool` kwargs logging for sample tools | **Mocked** HTTP |
| `test_health_endpoint.py` | `/health` ASGI response shape | **Live** (runs health probe against real API) |
| `test_health_check.py` | In-process `_run_health_check` | **Live** (`-m health_check`) |
| `test_stress.py` | 100 concurrent requests, 50% TCP disconnect | **Live server required** (`-m stress`) |

### 5.3 Stress test details

- **Marker:** `stress`
- **Requires:** Running server at `http://localhost:{MCP_PORT}/mcp`
- **Config:** `NUM_REQUESTS=100`, `MAX_CONCURRENT=20`, tool `search_datasets`
- **Behavior:** Alternates normal full-read requests with abrupt TCP disconnects; asserts server survives and completes non-cut requests

### 5.4 Dev script

`scripts/call_tool.py` — CLI wrapper around `mcp_client.call_tool_on_mcp` for manual tool testing against a running server.

---

## 6. CI/CD and release

### 6.1 CircleCI (`.circleci/config.yml`)

**Python version:** 3.14 (parameterized)

| Job | Steps |
|-----|-------|
| `lint` | `uv sync --frozen` → `ruff check --extend-select I .` → `ruff format --check .` → `ty check` |
| `test` | `uv sync --frozen` → `pytest -v --junitxml=test-results/junit.xml` |

Workflow `lint-test`: both jobs run on all branches (no branch filter in config).

### 6.2 GitHub Actions

Only `contribution-reminder.yml` — posts AI-policy reminder on new issues/PRs from non-collaborators. **No CI tests on GitHub Actions** (migrated to CircleCI in v0.2.5).

### 6.3 Pre-commit (`.pre-commit-config.yaml`)

- YAML check, EOF fixer, trailing whitespace, large files
- Ruff lint (with import sort `I`) + Ruff format

### 6.4 Docker

**Dockerfile:**

- Base: `astral/uv:python3.14-trixie-slim`
- Installs git (for setuptools-scm)
- `uv sync --frozen`
- `EXPOSE 8000`
- `CMD ["python", "main.py"]`

**docker-compose.yml:**

- Port mapping, env vars for host/port/DATAGOUV_API_ENV/Matomo
- Healthcheck via `/health`
- `restart: unless-stopped`

### 6.5 Release (`tag_version.sh`)

**Usage:** `./tag_version.sh <version> [--dry-run]`

**Prerequisites:** `gh` CLI authenticated, on `main`/`master`, clean working tree, up to date with remote.

**Actions:**

1. Collect commits since last tag (breaking changes `!:` first, sorted)
2. Update `CHANGELOG.md` with new section
3. Commit changelog, create annotated tag `v{version}`, push
4. Create GitHub release via `gh release create`

**Versioning:** `setuptools-scm` derives package version from git tags — no manual version in `pyproject.toml`.

**Deployment process (per README):** PR → CI → review → merge to `main` → periodic deploy to preprod (`mcp.preprod.data.gouv.fr`) → production (`mcp.data.gouv.fr`).

---

## 7. Behaviours to preserve

### Core MCP server

- [ ] Streamable HTTP transport only at `POST /mcp` (no STDIO/SSE)
- [ ] `stateless_http=True` for broad client compatibility
- [ ] DNS rebinding protection with production + localhost allowed hosts/origins
- [ ] `GET /health` deep check (in-process `search_datasets`, not recursive HTTP)
- [ ] Health response JSON schema (`status`, `uptime_since`, `version`, `env`, `data_env`)
- [ ] All 10 tools with equivalent names, titles, annotations, and docstrings
- [ ] Read-only tool annotations on every tool
- [ ] Plain-text (`str`) tool responses formatted for LLM consumption

### Search tools

- [ ] French stop-word cleaning with fallback to original query
- [ ] `search_datasets` sort and `last_update_range` pass-through
- [ ] `search_organizations` browse-without-query mode
- [ ] `resources_count` from API `resources.total` (not array length)

### Data access workflow

- [ ] Enforced workflow: search → list resources → query resource data
- [ ] `query_resource_data` filter operators and sort validation
- [ ] `page_size` default 20, max 200 for tabular queries
- [ ] Tabular API LLM-friendly error messages (404, 4xx, 5xx)
- [ ] `get_resource_info` Tabular availability check + crawler exceptions distinction
- [ ] Crawler exceptions cache (1h TTL, stale-on-error fallback)

### Dataservices

- [ ] Third-party API terminology (`dataservice_id`, not generic "API id")
- [ ] OpenAPI spec summarization (endpoints + parameters, not full schemas)

### Metrics

- [ ] `get_metrics` demo-environment guard
- [ ] `limit` clamped to 1–50 (not README's 100)
- [ ] None-safe metric value handling

### Observability

- [ ] Structured tool call logging (`Tool called: {name} | kwargs=...`)
- [ ] Matomo tool events (not bare `/mcp` pageviews)
- [ ] Matomo health_check event override
- [ ] Optional Sentry with `MCP_ENV` and sample rate
- [ ] `User-Agent: datagouv-mcp/{version}` on all upstream calls

### Environment

- [ ] `DATAGOUV_API_ENV` prod/demo URL mapping (including demo tabular → preprod tabular)
- [ ] Metrics API always prod URL regardless of env

### Testing parity

- [ ] pytest markers for stress and health_check exclusion
- [ ] Mocked tabular error tests
- [ ] Live integration tests against public APIs

---

## 8. Known pain points / improvement opportunities

### Format and data access gaps (primary user complaint)

- **Tabular API coverage is narrow:** Only CSV/XLSX (within size limits or exceptions). JSON, JSONL, GeoJSON, Shapefile, Parquet, XML, PDF, etc. require manual download from resource URL — no MCP tool assists with parsing.
- **`download_and_parse_resource` was removed** (v0.2.20) due to RAM/security concerns; gap remains for non-tabular formats.
- **Large datasets are laborious:** Must paginate `query_resource_data` (max 200 rows/page) or exit MCP to fetch raw files. Tool hints at 1000+ rows but offers no bulk export.
- **No column discovery tool:** LLMs must preview data to learn column names; `fetch_resource_profile` exists in client but is not an MCP tool (only used internally in tests and `get_resource_info` partial check).
- **Filter operator set is limited:** No `__in`, `__startswith`, regex, or null checks exposed.

### Documentation / code discrepancies

- README states `get_metrics` `limit` max **100**; code clamps to **50** (fixed in client v0.2.22 for API max, but README not updated).
- `docker-compose.yml` omits `MCP_ENV`, `LOG_LEVEL`, `SENTRY_*` env vars present in README.
- CHANGELOG mentions "docs: add TODO" (v0.2.19) but no TODO comments found in source.

### Error handling inconsistencies

- Some tools return structured `Error: ...` strings; `query_resource_data` uses emoji prefixes (`⚠️`, `❌`) for sub-errors.
- `list_dataset_resources` catches all exceptions generically without 404 specialization.
- `get_resource_info` makes ad-hoc Tabular profile request instead of reusing `tabular_api_client.fetch_resource_profile`.

### Performance / architecture

- **No retry logic** on any upstream API call (transient failures surface immediately).
- **No connection pooling** across tool calls — each helper function often creates a new `AsyncSession`.
- **N+1 potential** in `get_resource_info` (resource + dataset metadata + crawler + tabular profile = up to 4 calls).
- Matomo tracking is fire-and-forget (`create_task`) — failures only logged, never block tool response.

### Security / ops

- Default bind `0.0.0.0` (documented for prod; local dev should use `127.0.0.1`).
- No rate limiting on MCP endpoint.
- No authentication (intentionally read-only public data).

### Testing gaps

- No unit tests for individual MCP tool formatters (only client-level and logging).
- Stress test requires manual server start — not in CI.
- Health check and most integration tests require live network — flaky if APIs down.
- No tests for `get_dataservice_openapi_spec` summarization logic.

### Historical breaking changes to be aware of

- v0.2.6: `query_dataset_data` → `query_resource_data`; removed `limit`, added `page`
- v0.2.6: Removed `dataset_query` parameter
- v0.2.20: Removed `download_and_parse_resource`
- v0.2.24: Removed `question` from `query_resource_data`
- v0.2.25: Renamed API tools to dataservice terminology

### Dependency notes

- HTTP client: **niquests** (replaced httpx in v0.2.29)
- Python: `>=3.13,<3.15` (Docker uses 3.14)
- MCP SDK: `>=1.25.0,<2`

---

## 9. Version info

| Source | Version |
|--------|---------|
| `CHANGELOG.md` (latest entry) | **0.2.30** (2026-07-17) |
| `pyproject.toml` | `dynamic = ["version"]` via `setuptools-scm` |
| Git tags | `v{version}` created by `tag_version.sh` |

---

## Appendix A: Tool registration order

From `tools/__init__.py`:

1. `search_datasets`
2. `search_organizations`
3. `search_dataservices`
4. `get_dataservice_info`
5. `get_dataservice_openapi_spec`
6. `query_resource_data`
7. `get_dataset_info`
8. `list_dataset_resources`
9. `get_resource_info`
10. `get_metrics`

Registration order may affect tool listing order in some MCP clients.

## Appendix B: `clean_search_query` stop words

```
données, donnee, donnees, fichier, fichiers, fichier de, fichiers de,
tableau, tableaux, csv, excel, xlsx, json, xml
```

Case-insensitive; multiple spaces collapsed.
