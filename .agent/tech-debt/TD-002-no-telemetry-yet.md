# TD-002: Matomo and Sentry parsed from config but not wired

**Status**: scheduled (workstream C, milestone M3)
**Impact**: medium (production parity)
**Created**: 2026-09-03
**Owner**: unassigned

## Description

`core/config.ts` parses `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`, `SENTRY_DSN`, `SENTRY_SAMPLE_RATE` (legacy names) but nothing consumes them yet. Legacy behaviour to reproduce (research/01 §3.9–3.10): fire-and-forget tool events `e_c=tools e_a=<tool>` with page URL / UA / client IP (`cip` only with auth token), `health_check` override, Sentry init with `environment=MCP_ENV`, `send_default_pii=false`.

## Impact

Deploying 1.0 to `mcp.data.gouv.fr` would silently drop usage analytics and error reporting.

## Proposed fix

`src/server/telemetry/matomo.ts` + `sentry.ts` (optional `@sentry/node` dependency loaded dynamically), hooked in `tools/registry.ts` via an optional `onToolCall` callback in `RegistryOptions` so the tools layer stays free of HTTP concerns. Tests with `routedFetch`.
