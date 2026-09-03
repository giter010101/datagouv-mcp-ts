# 0003: Hono for Streamable HTTP; stdio default; stateless sessions

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

Legacy served Streamable HTTP only (`/mcp`, `/health`), stateless, with DNS-rebinding protection for `mcp.data.gouv.fr`, preprod and localhost. Local IDE clients (Cursor, Claude Desktop, Codex…) prefer stdio. SDK 1.30 offers `StreamableHTTPServerTransport` (Node req/res, Express-oriented) and `WebStandardStreamableHTTPServerTransport` (`Request → Response`), and already depends on `hono` and `@hono/node-server` internally.

Options: (a) `node:http` + Node transport — minimal but manual routing/CORS/guards; (b) Express 5 — SDK examples, heavier; (c) Hono + web-standard transport — tiny, typed router, testable via `app.request()` without sockets, same libs the SDK bundles.

## Decision

- **Hono** (`src/server/http.ts`) with `WebStandardStreamableHTTPServerTransport`; served by `@hono/node-server`.
- **stdio is the default transport** (`datagouv-mcp`); `--http` or `MCP_TRANSPORT=http` starts HTTP. Logs always go to stderr.
- HTTP mode is **stateless** (`sessionIdGenerator: undefined`) with `enableJsonResponse: true`: a fresh `McpServer` + transport per request, closed after the response — mirrors legacy `stateless_http=True` and avoids "session not found" with clients that drop `mcp-session-id`. Server-initiated notifications are not used.
- `GET /health` performs the legacy deep probe (in-process `searchDatasets("transport", 1)`, 10 s cap) and returns the legacy JSON shape (`status, uptime_since, version, env, data_env`; 503 `mcp_unavailable`).
- DNS-rebinding guard implemented as a Hono middleware (`hostOriginGuard`): Host must be in `MCP_ALLOWED_HOSTS` (default prod, preprod, localhost, 127.0.0.1, [::1]; ports ignored); when an `Origin` header is present it must be in `MCP_ALLOWED_ORIGINS` (`*` disables). The SDK's `hostHeaderValidation` is Express-only, hence our own.
- Legacy HTTP+SSE transport is **not** provided.

## Consequences

### Positive
- `/mcp` works with every current client; `app.request()` makes transport tests socket-free; a future edge/serverless deployment needs no code change.
- Stateful mode (sessions, resumability, progress notifications) can be added later behind a flag without touching tools.

### Negative
- Per-request `McpServer` creation costs a few hundred microseconds (tool registration only) — acceptable.
- No SSE streaming of progress in HTTP mode for long queries; mitigated by strict pagination and time caps.

### Neutral
- Bind address defaults to `127.0.0.1` (MCP security guidance); Docker/compose set `MCP_HOST=0.0.0.0` explicitly (legacy defaulted to 0.0.0.0).
