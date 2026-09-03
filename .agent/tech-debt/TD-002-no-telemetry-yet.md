# TD-002: Matomo and Sentry telemetry

**Status**: partial (Matomo live; Sentry log-only)
**Impact**: medium (production parity)
**Created**: 2026-09-03
**Resolved**: 2026-09-03 (partial)
**Owner**: Grok (WS C)

## Description

`core/config.ts` parses `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_SAMPLE_RATE` (legacy names). Legacy behaviour (research/01 §3.9–3.10): fire-and-forget tool events `e_c=tools e_a=<tool>` with page URL / UA / client IP (`cip` only with auth token), `health_check` override, Sentry init with `environment=MCP_ENV`, `send_default_pii=false`.

## Resolution (partial)

- **Matomo**: wired via `src/server/telemetry.ts` + `createTelemetry()`; hooked in `mcp-server.ts` via `onToolCall`; unit tests in `tests/unit/server/telemetry.test.ts` (fire-and-forget POST).
- **Sentry**: structured error logging only — no `@sentry/node` SDK, no event ingest to Sentry backend.
- **Gap**: Matomo lacks `cip`/UA forwarding noted in exec-plan §9; full Sentry SDK parity deferred.

## Remaining work (optional for 1.0)

1. Add `@sentry/node` (dynamic import) for real event ingest.
2. Forward client IP / UA to Matomo when `MATOMO_AUTH_TOKEN` set.
