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
| Legacy Python reference | — (read-only) | `legacy/python/**` — delete at M6 (TD-004) | frozen |

## Development workstreams (M1–M6)

| WS | Owner agent | Files / directories (exclusive) | Depends on | Status |
|----|-------------|----------------------------------|------------|--------|
| **A — core + clients** | Fable → Grok | `src/core/**`, `src/clients/**`, `tests/fixtures/api/**`, `tests/contract/**` | M0 | **done** — 5 clients + `createClients()`; mappers/schemas; **5 contract test files**; typecheck + `pnpm check` green |
| **B — formats** | Grok | `src/formats/**`, `tests/fixtures/files/**`, `tests/unit/formats/**` | M0 | **done** — detector, parsers, engines, 11 accessors, `defaultAccessors()` / `openResource()`; unit tests green |
| **C — MCP tools + server** | Fable → Grok | `src/tools/**`, `src/server/**`, `src/index.ts`, `tests/e2e/**` | M0; A; B | **done** — **21 tools** in `ALL_TOOLS`; `createDeps` wires `createClients` + formats; stdio/HTTP; **telemetry** (`createTelemetry`, Matomo live, Sentry log-only — TD-002 partial); facets restored (TD-008 resolved) |
| **D — tests & evidence** | Fable → Composer | `tests/helpers/**`, `tests/live/**`, `scripts/evidence*.ts`, `scripts/conformance.ts`, `docs/evidence/**`, `vitest.config.ts` | M0 | **done** — **21/21 offline + 21/21 live** evidence (`coverage.md` 42 PASS rows); `pnpm evidence:check` green; `pnpm test:conformance` green locally; 5 contract suites; 1 automated live vitest (`search_datasets`); nightly live workflow |
| **E — docs / CI / release** | Fable | `README.md`, `docs/**` (except `docs/evidence`), `.github/**`, `Dockerfile`, `docker-compose.yml`, `.changeset/**`, `CHANGELOG.md`, `.agent/skills/release.md` | M0 | **mostly done** — README, docs/*, CI matrix Node 22/24 + Docker `/health` smoke; **gaps**: `evidence:check` not in CI, `test:conformance` `continue-on-error`; package `1.0.0-alpha.0` (M6 open) |

Shared files (coordinate, small commits, rebase): `package.json` / `pnpm-lock.yaml` (deps via `pnpm add`), `src/clients/types.ts`, `src/formats/types.ts`, `src/core/types.ts` (additive only), `.agent/ownership.md` (orchestrator only), `.agent/AGENTS.md` (orchestrator/architect).

**Status values**: `pending` · `in_progress` · `review` · `mostly done` · `done` · `blocked` · `frozen`
