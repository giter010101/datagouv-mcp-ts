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
| **A — core + clients** | Fable (interrupted) | `src/clients/**`, `src/core/**` (additive), `tests/fixtures/**` (API JSON), `tests/contract/**`, `.agent/exec-plans/active/ws-a-clients.md` | M0 | **partial** — all 5 clients + `createClients` on disk; 1 type error in `mappers/dataset.ts`; no contract tests |
| **B — formats** | Fable (interrupted) | `src/formats/**`, `tests/fixtures/files/**`, `tests/unit/formats/**`, `.agent/exec-plans/active/ws-b-formats.md` | M0 (uses A's interfaces via fakes) | **partial** — detector/parsers/engines complete (`89292f9`); **zero `ResourceAccessor` impls**; empty registry |
| **C — MCP tools + server** | Fable (interrupted) | `src/tools/**`, `src/server/**`, `src/index.ts`, `tests/e2e/**`, `.agent/exec-plans/active/ws-c-tools-server.md` | M0; A for legacy metadata tools; B for M4 tools | **partial** — 21 tool files; **only `search_datasets` registered**; `server/deps.ts` not widened; 3 type errors |
| **D — tests & evidence** | Fable (earlier commits) | `tests/helpers/**`, `tests/live/**`, `scripts/evidence.ts`, `scripts/record-fixtures.ts`, `docs/evidence/**`, `vitest.config.ts`, `.agent/exec-plans/active/ws-d-tests-evidence.md` | M0 | **partial** — harness + 42 fixtures + vitest projects; 1/21 evidence; no contract tests; 1 e2e fail |
| **E — docs / CI / release** | Fable (earlier commits) | `README.md`, `docs/**` (except `docs/evidence`), `.github/**`, `Dockerfile`, `docker-compose.yml`, `.changeset/**`, `CHANGELOG.md`, `.agent/skills/release.md`, `.agent/exec-plans/active/ws-e-docs-ci-release.md` | M0 | **mostly done** — README/docs/CI/Docker/changesets landed; CONTRIBUTING/SECURITY in WIP; tool docs ahead of registration |

Shared files (coordinate, small commits, rebase): `package.json` / `pnpm-lock.yaml` (deps via `pnpm add`), `src/clients/types.ts`, `src/formats/types.ts`, `src/core/types.ts` (additive only), `.agent/ownership.md` (orchestrator only), `.agent/AGENTS.md` (orchestrator/architect).

**Status values**: `pending` · `in_progress` · `review` · `done` · `blocked` · `frozen`
