# Configuration

Source of truth: [`src/core/config.ts`](../src/core/config.ts) (`loadConfig`). Variables are read once
at startup from the environment and validated with Zod; an invalid value aborts startup with
`CONFIG_ERROR: Invalid configuration: <var>: <issue>; …` listing **every** problem. Template:
[`.env.example`](../.env.example). Legacy Python variable names are unchanged.

Boolean variables accept `1`, `true`, `yes`, `on` (case-insensitive); anything else is `false`.
Empty strings are treated as unset. Lists are comma-separated, whitespace trimmed.

## Transport and network

| Variable | Type / range | Default | Description |
|----------|--------------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` \| `http` | `stdio` | Transport. CLI flags `--http` / `--stdio` take precedence. |
| `MCP_HOST` | string | `127.0.0.1` | Bind address of the HTTP server. Legacy default was `0.0.0.0`; the Docker image and compose set `0.0.0.0` explicitly. CLI `--host`. |
| `MCP_PORT` | int 1–65535 | `8000` | HTTP port. CLI `--port`. |
| `MCP_ENV` | string | `local` | Deployment name: `/health` → `env`, Sentry `environment`. Use `prod`, `preprod`, `demo`, `docker`… |
| `MCP_ALLOWED_HOSTS` | list | `mcp.data.gouv.fr`, `mcp.preprod.data.gouv.fr`, `localhost`, `127.0.0.1`, `[::1]` | Hostnames accepted in the `Host` header (DNS-rebinding protection). Ports are ignored, comparison is case-insensitive. Requests with another host get `421 {"error":"Invalid Host header"}`. **Setting the variable replaces the default list** — include `localhost`/`127.0.0.1` if you still need them. |
| `MCP_ALLOWED_ORIGINS` | list | `https://mcp.data.gouv.fr`, `https://mcp.preprod.data.gouv.fr`, `http://localhost`, `http://127.0.0.1` | Origins accepted when the request carries an `Origin` header (browser clients). Compared as `scheme://host` (port ignored). `*` disables the check. Rejections get `403 {"error":"Origin not allowed"}`. Requests without `Origin` (CLIs, servers) are not affected. |

## Upstream environment

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `DATAGOUV_API_ENV` | `prod` \| `demo` | `prod` | Selects the base URLs below. Unknown values silently fall back to `prod` (legacy behaviour). |

| Service | `prod` | `demo` |
|---------|--------|--------|
| udata API (`datagouvApi`) | `https://www.data.gouv.fr/api/` (+ `1/` or `2/`) | `https://demo.data.gouv.fr/api/` |
| Site (`site`) | `https://www.data.gouv.fr/` | `https://demo.data.gouv.fr/` |
| Tabular API | `https://tabular-api.data.gouv.fr/api/` | `https://tabular-api.preprod.data.gouv.fr/api/` |
| Metrics API | `https://metric-api.data.gouv.fr/api/` | same — **no demo instance**; `get_metrics` refuses to run in `demo` |
| Crawler API | `https://crawler.data.gouv.fr/api/` | `https://demo-crawler.data.gouv.fr/api/` |
| Schema catalogue | `https://schema.data.gouv.fr/` | same |
| Validata | `https://api.validata.etalab.studio/` | same |

## Logging

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` (any case) | `info` | pino level. Legacy uppercase Python levels are mapped: `CRITICAL`→`fatal`, `ERROR`, `WARNING`/`WARN`→`warn`, `INFO`, `DEBUG`, `TRACE`/`NOTSET`→`trace`. Invalid values are a startup error. |

Logs are JSON lines on **stderr** in both transports (stdout is reserved for the stdio protocol).
Per tool call: `tool called` (args), `tool completed` (duration), `tool failed` (code). Tokens are redacted.
Pretty-print locally with `pnpm dev 2>&1 | npx pino-pretty`.

## HTTP client, cache, limits

| Variable | Type / range | Default | Description |
|----------|--------------|---------|-------------|
| `HTTP_TIMEOUT_MS` | int ≥ 100 | `15000` | Timeout per upstream call. Some calls override (spec fetch, tabular data 30 s). |
| `HTTP_RETRIES` | int 0–10 | `2` | Retries on 408/425/429/5xx and network errors, exponential backoff with jitter; `Retry-After` honoured (capped 10 s); 404 never retried. |
| `MAX_DOWNLOAD_BYTES` | int ≥ 1024 | `52428800` (50 MiB) | Cap on bytes downloaded from a resource URL for in-process parsing (preview/query of CSV, XLSX, JSON, Parquet, archives). Enforced from `Content-Length` and while streaming → `PAYLOAD_TOO_LARGE`. |
| `CACHE_MAX_ENTRIES` | int ≥ 0 | `500` | LRU size (entries). `0` disables caching (useful in tests). |
| `CACHE_DEFAULT_TTL_MS` | int ≥ 0 | `300000` (5 min) | Default TTL. Per-data TTLs (search 60 s, crawler exceptions 1 h, capability reports 10 min…) are fixed in code — see [architecture.md](architecture.md#cross-cutting-policies). |
| `MAX_OUTPUT_CHARS` | int ≥ 1000 | `40000` | Soft cap on the text content of one tool result (~10k tokens). Truncation appends `[Output truncated: …]` and sets `structuredContent.text_truncated = true`. |

## Optional engines

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_DUCKDB` | bool | `false` | Enables the DuckDB `QueryEngine` (SQL over remote CSV/Parquet/JSON, `query_resource` `sql` mode). Requires `@duckdb/node-api` to be installed (optional native dependency, ~50–80 MB). When disabled, `sql` requests return `ENGINE_UNAVAILABLE` with a hint to use filters. |

## Optional telemetry

Disabled unless set. Matomo needs **both** `MATOMO_URL` and `MATOMO_SITE_ID`.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MATOMO_URL` | URL | unset | Matomo instance, e.g. `https://matomo.example.org`. One event per tool call (`e_c=tools`, `e_a=<tool>`), fire-and-forget; `/health` probes are tracked as `health_check`. |
| `MATOMO_SITE_ID` | string | unset | Matomo site id. |
| `MATOMO_AUTH_TOKEN` | string | unset | When set, forwards the client IP from `X-Forwarded-For` (`cip`). |
| `SENTRY_DSN` | string | unset | Enables Sentry error reporting (`environment = MCP_ENV`, no default PII). |
| `SENTRY_SAMPLE_RATE` | float 0–1 | `1` | Traces/profiles sample rate. |

## CLI flags

```
datagouv-mcp                 stdio transport (default)
datagouv-mcp --http          Streamable HTTP on http://MCP_HOST:MCP_PORT/mcp
datagouv-mcp --http --port 8000 --host 127.0.0.1
  --http | --stdio           override MCP_TRANSPORT
  --port <n> | --host <addr> override MCP_PORT / MCP_HOST
  -h, --help | -v, --version
```

## Examples

```shell
# Local IDE use, demo platform, verbose
DATAGOUV_API_ENV=demo LOG_LEVEL=debug npx -y datagouv-mcp

# Self-hosted behind https://mcp.example.org
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8000 MCP_ENV=prod \
MCP_ALLOWED_HOSTS=mcp.example.org,localhost,127.0.0.1 \
MCP_ALLOWED_ORIGINS=https://mcp.example.org \
datagouv-mcp
```

Client `env` blocks (stdio) pass variables to the process, e.g. Cursor / Claude Desktop:

```json
{ "command": "npx", "args": ["-y", "datagouv-mcp"], "env": { "DATAGOUV_API_ENV": "demo", "LOG_LEVEL": "warn" } }
```
