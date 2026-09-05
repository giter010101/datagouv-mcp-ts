---
"datagouv-mcp": minor
---

TypeScript rewrite of the data.gouv.fr MCP server (first alpha).

- Runs on Node 22 with `@modelcontextprotocol/sdk` 1.x; published as `datagouv-mcp` (`npx datagouv-mcp`).
- Transports: **stdio** (default, for IDE/CLI clients) and stateless **Streamable HTTP** (`POST /mcp`, `GET /health`) with Host/Origin (DNS-rebinding) protection.
- Legacy tool names, parameters and in-band messages preserved (`search_datasets` first); every tool also returns `structuredContent` and bounded text output.
- Configuration keeps the legacy variable names (`MCP_HOST`, `MCP_PORT`, `DATAGOUV_API_ENV`, `LOG_LEVEL`, `MATOMO_*`, `SENTRY_*`) and adds `MCP_TRANSPORT`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `HTTP_TIMEOUT_MS`, `HTTP_RETRIES`, `MAX_DOWNLOAD_BYTES`, `CACHE_*`, `MAX_OUTPUT_CHARS`, `ENABLE_DUCKDB`.
- Multi-stage Docker image (`node:22-slim`, non-root) and `docker-compose.yml` with a `/health` check.
