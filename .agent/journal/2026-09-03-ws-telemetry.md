# Session: WS telemetry

**Date**: 2026-09-03
**Agent**: Grok (telemetry)
**Branch**: `cursor/datagouv-mcp-typescript-refonte-57e0`

## What was done

- Added `src/server/telemetry.ts`: `Telemetry` + `createTelemetry`.
- No-op when Matomo and Sentry are both unset.
- Matomo: fire-and-forget `POST {MATOMO_URL}/matomo.php` (`e_c=tools`, `e_a=<tool>`, `e_n=ok|err`, `e_v=durationMs`).
- Sentry: no SDK; structured pino error with `sentryDsnSet` (never logs the DSN).
- Wired `onToolCall` in `createMcpServer` via existing registry hook.

## Files touched

- `src/server/telemetry.ts` — created
- `src/server/mcp-server.ts` — `onToolCall` wiring
- `src/server/index.ts` — re-export
- `tests/unit/server/telemetry.test.ts` — created
- `.agent/journal/2026-09-03-ws-telemetry.md` — this file

## Decisions

- Single module (not `telemetry/matomo.ts` + `sentry.ts`) per workstream ownership.
- No `@sentry/node`: DSN presence + error logs only.
- Telemetry never throws; registry also swallows hook errors.

## Next steps

- Optional: HTTP request context (URL / UA / `cip`) and `/health` `health_check` from `http.ts`.
