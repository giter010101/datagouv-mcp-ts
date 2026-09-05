# TD-005: HTTP transport is stateless/JSON-only; no sessions, SSE or progress notifications

**Status**: open
**Impact**: low
**Created**: 2026-09-03
**Owner**: unassigned (workstream C)

## Description

`src/server/http.ts` creates a `McpServer` + `WebStandardStreamableHTTPServerTransport` per request with `enableJsonResponse: true` (ADR 0003). Long-running queries (large Parquet scans, DuckDB) cannot stream progress; the legacy HTTP+SSE transport is not offered; conformance tests for stateful features are skipped.

## Impact

Fine for parity; may limit UX for `query_resource` on big files and for clients that rely on server notifications.

## Proposed fix

Add `MCP_HTTP_SESSIONS=1` mode: session map keyed by `mcp-session-id`, `sessionIdGenerator: randomUUID`, SSE responses, idle eviction; keep stateless as default. Track `/mcp` GET/DELETE handling and the conformance report.
