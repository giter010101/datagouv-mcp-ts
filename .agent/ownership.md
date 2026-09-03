# Ownership Matrix

Orchestrator maintains this table. **Check before starting any work.** Update status when claiming or completing.
Master plan: `exec-plans/001-typescript-rewrite.md` (§12 for the shared-file protocol).

## Research & architecture

| Workstream | Owner agent | Files / directories | Status |
|------------|-------------|---------------------|--------|
| Python MCP audit | research-01 | `.agent/research/01-existing-python-mcp-audit.md` | done |
| Platform survey | research-02 | `.agent/research/02-datagouv-platform-survey.md` | done |
| Resource formats catalog | research-03 | `.agent/research/03-resource-formats-catalog.md` | done |
| Harness & TS stack research | research-04 | `.agent/research/04-harness-engineering-and-ts-stack.md`, `.agent/rules/`, `.agent/skills/` | done |
| Architecture, ADRs, scaffold (M0) | architect | `.agent/exec-plans/001-typescript-rewrite.md`, `.agent/decisions/`, initial `src/**`, toolchain config | done |
| Legacy Python reference | — (read-only) | `legacy/python/**` — delete at M3 | frozen |

## Development workstreams (M1–M6)

| WS | Owner agent | Files / directories (exclusive) | Depends on | Status |
|----|-------------|----------------------------------|------------|--------|
| **A — core + clients** | Fable → Grok | `src/core/**`, `src/clients/**` (`types.ts`, `index.ts` `createClients`, `datagouv-client.ts`, `tabular-client.ts`, `metrics-client.ts`, `crawler-client.ts`, `schema-client.ts`, `datagouv-reference.ts`, `openapi.ts`, `mappers/**`, `schemas/**`), `tests/fixtures/api/**`, `tests/contract/**` (not started) | M0 | **mostly done** — all 5 clients + `createClients()`; mappers/schemas complete; typecheck green; **no `tests/contract/**` yet** |
| **B — formats** | Grok | `src/formats/**` (`capability.ts`, `download.ts`, `parsers/**`, `engines/**`, `accessors/**`, `open.ts`, `registry.ts`, `index.ts`), `tests/fixtures/files/**`, `tests/unit/formats/**` | M0 | **done** — detector, parsers, engines, 11 accessors, `defaultAccessors()` / `openResource()`; offline unit tests green |
| **C — MCP tools + server** | Fable → Grok | `src/tools/**` (21 tool files + `registry.ts`, `deps.ts`, `index.ts` `ALL_TOOLS`), `src/server/**` (`deps.ts`, `mcp-server.ts`, `stdio.ts`, `http.ts`), `src/index.ts`, `tests/e2e/**`, `server/telemetry/**` (not started) | M0; A; B | **mostly done** — **21 tools registered**; `createDeps` wires `createClients` + formats; stdio/HTTP transports OK; telemetry not started; sibling editing `deps.ts` / `search-datasets.ts` |
| **D — tests & evidence** | Fable → Composer | `tests/helpers/**`, `tests/live/**`, `scripts/evidence.ts`, `scripts/evidence-coverage.ts`, `scripts/record-fixtures.ts`, `scripts/conformance.ts`, `docs/evidence/**`, `vitest.config.ts` | M0 | **mostly done** — harness + fixtures; 21/21 tools mapped in `docs/evidence/coverage.md` (offline fixture calls + live `search_datasets`); `pnpm evidence:check` gate; contract tests still missing |

| **E — docs / CI / release** | Fable | `README.md`, `docs/**` (except `docs/evidence`), `.github/**`, `Dockerfile`, `docker-compose.yml`, `.changeset/**`, `CHANGELOG.md`, `.agent/skills/release.md` | M0 | **mostly done** — README, docs/*, CI (`pnpm check`), Docker, nightly live, changesets; CONTRIBUTING/SECURITY present |

Shared files (coordinate, small commits, rebase): `package.json` / `pnpm-lock.yaml` (deps via `pnpm add`), `src/clients/types.ts`, `src/formats/types.ts`, `src/core/types.ts` (additive only), `.agent/ownership.md` (orchestrator only), `.agent/AGENTS.md` (orchestrator/architect).

**Status values**: `pending` · `in_progress` · `review` · `mostly done` · `done` · `blocked` · `frozen`
