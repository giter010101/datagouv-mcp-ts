# 0010: Testing pyramid and proof-of-function evidence

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

Legacy tests hit live APIs by default (flaky, slow) and had no tool-level tests. Agents need fast deterministic feedback plus proof that tools work against the real platform before a milestone is closed (`rules/testing-and-evidence.md`).

## Decision

| Level | Location | Network | Gate |
|-------|----------|---------|------|
| Unit | `src/**/*.test.ts`, `tests/unit/**` | none | every commit |
| Contract | `tests/contract/**` + recorded fixtures `tests/fixtures/<service>/*.json` | none — `routedFetch` or undici `MockAgent` through `fetchImpl` injection | every commit |
| MCP e2e | `tests/e2e/**` — SDK `Client` over `InMemoryTransport` (`startTestServer`) and over HTTP loopback (`runHttp` port 0) | none | every commit |
| Architecture | `tests/unit/layering.test.ts` | none | every commit |
| Conformance | `@modelcontextprotocol/conformance` against built server | none | CI job (D) |
| Live smoke | `tests/live/**.live.test.ts`, `RUN_LIVE_TESTS=1` (`pnpm test:live`) | yes | nightly + pre-release |
| Evidence | `pnpm evidence --tool <name> --input <json> [--stdio]` → `docs/evidence/<tool>-<date>.md` (+ raw JSON git-ignored) | yes, real execution | required for every new/changed tool before its milestone box is ticked |

Rules:
- Fixtures are **recorded from the live API** (script `scripts/record-fixtures.ts`, workstream D) with real IDs listed in research/02 §11 and research/03 §9; re-record when shapes change and note it in CHANGELOG.
- e2e tests assert `structuredContent` shape, text landmarks, `isError` paths (404, 5xx, invalid input) — not exact prose.
- Coverage targets: `core`/`clients`/`formats` ≥ 90 % lines; 100 % of tools have an e2e test + evidence report.
- Tests never write inside the repo except `docs/evidence/` (reports) — temporary files go to `os.tmpdir()`.
- `LOG_LEVEL=silent` in vitest by default.

## Consequences

### Positive
- `pnpm test` runs in < 1 s today and stays offline; live drift is caught nightly; evidence is reproducible by anyone with the command printed in each report.

### Negative
- Fixtures need maintenance when udata evolves; mitigated by loose Zod schemas.

### Neutral
- The legacy stress test (100 concurrent, 50 % disconnects) is ported by D as an opt-in script, not a default test.
