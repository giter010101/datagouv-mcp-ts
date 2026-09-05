# Migration from the Python server

The TypeScript server is a drop-in replacement for the Python implementation (`datagouv-mcp`
0.2.x, now frozen under [`legacy/python/`](../legacy/python/) until tool parity, then deleted).
Existing client configurations pointing at `https://mcp.data.gouv.fr/mcp` keep working; this page
lists what is identical, what is new, and the few behaviour differences.

## Tool parity

Names, titles, parameters, defaults and clamps of the 10 legacy tools are frozen
([ADR 0007](../.agent/decisions/0007-tool-naming-and-compat.md)); parameters may be **added**
(optional), never removed or renamed in 1.x. Registration order is unchanged.

| # | Legacy tool (Python) | TypeScript tool | Status | Notes |
|---|----------------------|-----------------|--------|-------|
| 1 | `search_datasets` | `search_datasets` | ported | Same stop-word cleaning + fallback, `sort`, `last_update_range`; `resources_count` from `resources.total`. New optional facet filters planned (`organization`, `tag`, `license`, `format`, `badge`, `geozone`, `granularity`, `schema`, `topic`). |
| 2 | `search_organizations` | `search_organizations` | porting | Browse mode with empty `query`; `badge`, `name`, `business_number_id`, `sort`. |
| 3 | `search_dataservices` | `search_dataservices` | porting | Includes `base_api_url`. |
| 4 | `get_dataservice_info` | `get_dataservice_info` | porting | 404 → `Error: Third-party API not found (dataservice_id='…').` |
| 5 | `get_dataservice_openapi_spec` | `get_dataservice_openapi_spec` | porting | JSON and YAML specs; endpoint summary only (method, path, summary, params; ≤ 3 servers). |
| 6 | `query_resource_data` | `query_resource_data` | porting | Tabular API only, operators `exact/contains/less/greater/strictly_less/strictly_greater` (+ new `differs`, `in`), `page_size` 1–200, legacy `⚠️`/`❌` messages preserved. |
| 7 | `get_dataset_info` | `get_dataset_info` | porting | Description 500 chars, tags ≤ 10, license, frequency, dates. |
| 8 | `list_dataset_resources` | `list_dataset_resources` | porting | Single API call; **new** per-resource `access_hint` (offline capability detection). |
| 9 | `get_resource_info` | `get_resource_info` | porting | Tabular availability + crawler-exception distinction kept; now returns a full `CapabilityReport` (Parquet URL, dead link, stream size…). |
| 10 | `get_metrics` | `get_metrics` | porting | Demo guard; `limit` 1–50 (the legacy README said 100 — the code clamped to 50); `null` → 0. |
| — | `download_and_parse_resource` (removed in 0.2.20) | `preview_resource` / `query_resource` | planned | Deliberately a different name: bounded (`MAX_DOWNLOAD_BYTES`), format-aware, never returns raw file bytes. |

New tools (no legacy equivalent): `get_resource_schema`, `preview_resource`, `query_resource`,
`check_resource_availability`, `get_dataset_resources_summary`, `suggest`, `search_reuses`,
`search_topics` / `get_topic`, `list_schemas` / `get_schema`, optional `validate_resource_against_schema`
and `geo_lookup` — see [tools.md](tools.md). Status column above is refreshed from `src/tools/index.ts`
at each release.

## Behaviour differences

| Area | Python 0.2.x | TypeScript 1.x |
|------|--------------|----------------|
| Transports | Streamable HTTP only | **stdio (default)** + Streamable HTTP (`--http`). SSE still not offered. |
| HTTP sessions | stateless | stateless, JSON responses (`enableJsonResponse`), identical from the client's point of view |
| Tool results | text only | text **and** `structuredContent` (snake_case mirror); text layout kept legacy-compatible |
| Errors | free-text `Error: …` in the content, `isError` not set | same message **plus** `isError: true` and `structuredContent.error = { code, message, hint, retryable }` — clients that ignore `isError` see the same text |
| Output size | unbounded | soft cap `MAX_OUTPUT_CHARS` (40k chars) with explicit truncation notice; tables ≤ 200 rows, cells ≤ 100 chars |
| Retries | none | 2 retries with backoff on 408/425/429/5xx and network errors; `Retry-After` honoured |
| Caching | crawler exceptions only (1 h) | in-memory LRU for search (60 s), details (5 min), tabular profile (10 min), crawler (1 h, stale-on-error), capability reports (10 min)… |
| Connection reuse | new HTTP session per call | one `fetch`/undici pool per process |
| Health probe | in-process `search_datasets` | same probe, same JSON shape (`status, uptime_since, version, env, data_env`), 10 s cap |
| Bind address | `0.0.0.0` | **`127.0.0.1`** — Docker image and compose set `0.0.0.0` explicitly |
| DNS-rebinding guard | SDK `TransportSecuritySettings` (prod, preprod, localhost) | own middleware with the same defaults, configurable via `MCP_ALLOWED_HOSTS` / `MCP_ALLOWED_ORIGINS`; `421` / `403` responses |
| Logging | Python `logging` text lines, level `INFO` | pino JSON lines on stderr, level `info`; uppercase legacy levels accepted |
| Matomo / Sentry | built in | same variables; wired as optional telemetry modules (`src/server/telemetry/`) |
| Version | `setuptools-scm` from git tags | `package.json` version via changesets; `datagouv-mcp --version` |
| Runtime | Python 3.13/3.14, `uv` | Node.js ≥ 22, `pnpm`; single-file bundle `dist/index.js` |
| Docker | `astral/uv:python3.14-trixie-slim`, root user | `node:22-slim`, non-root, `HEALTHCHECK`, read-only compose |
| CI / release | CircleCI + `tag_version.sh` | GitHub Actions + changesets (`v*` tags, GitHub releases, GHCR, npm with provenance) |

## Environment variable compatibility

All legacy variables keep their names and semantics. New ones are optional.

| Variable | Legacy | TypeScript | Change |
|----------|--------|------------|--------|
| `MCP_HOST` | `0.0.0.0` | `127.0.0.1` | **default changed** (security). Set `MCP_HOST=0.0.0.0` explicitly in containers (the image does). |
| `MCP_PORT` | `8000` | `8000` | same |
| `MCP_ENV` | `local` | `local` | same |
| `DATAGOUV_API_ENV` | `prod` \| `demo` | same | same URL mapping (demo tabular → preprod tabular; metrics always prod) |
| `LOG_LEVEL` | `INFO`, `DEBUG`, `WARNING`, `ERROR`, `CRITICAL` | pino levels | legacy uppercase values still accepted and mapped (`WARNING`→`warn`, `CRITICAL`→`fatal`) |
| `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN` | optional | optional | same |
| `SENTRY_DSN`, `SENTRY_SAMPLE_RATE` | optional, `1.0` | optional, `1` | same |
| `MCP_TRANSPORT` | — | `stdio` | new |
| `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS` | hard-coded | configurable lists | new (defaults = legacy hard-coded values) |
| `HTTP_TIMEOUT_MS`, `HTTP_RETRIES` | 15 s, none | `15000`, `2` | new |
| `MAX_DOWNLOAD_BYTES`, `CACHE_MAX_ENTRIES`, `CACHE_DEFAULT_TTL_MS`, `MAX_OUTPUT_CHARS`, `ENABLE_DUCKDB` | — | see [configuration.md](configuration.md) | new |
| `TEST_DATASET_ID`, `TEST_RESOURCE_ID`, `RESOURCE_ID` (tests) | pytest | — | replaced by fixtures + `RUN_LIVE_TESTS=1` |

## Operating the new server

| Task | Python | TypeScript |
|------|--------|------------|
| Run locally | `uv sync && uv run main.py` | `npx -y datagouv-mcp --http` (or `pnpm dev:http` from source) |
| Docker | `docker compose up -d` | `docker compose up -d` (same command, new image) |
| Tests | `uv run pytest` (live by default) | `pnpm test` (offline), `pnpm test:live` (live) |
| Stress test | `uv run pytest -m stress` | opt-in script ported by the tests workstream (see `docs/development.md`) |
| Call a tool from the CLI | `python scripts/call_tool.py <tool> '<json>'` | `pnpm evidence --tool <tool> --input '<json>' --stdio` or MCP Inspector |
| Health | `GET /health` | `GET /health` (same shape) |
| Release | `./tag_version.sh <version>` | changesets (`pnpm changeset`, version PR, automatic publish) |

## Client configuration changes

None required for the hosted endpoint. Local users can now drop `mcp-remote` and run the server as a
stdio process: `{"command": "npx", "args": ["-y", "datagouv-mcp"]}` (see the [README](../README.md#connect-your-client)).
