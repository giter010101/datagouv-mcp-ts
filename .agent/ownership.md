# Ownership Matrix

Orchestrator maintains this table. **Check before starting any work.** Update status when claiming or completing.

| Workstream | Owner agent | Files / directories | Status |
|------------|-------------|---------------------|--------|
| Python MCP audit | research-01 | `.agent/research/01-existing-python-mcp-audit.md` | in_progress |
| Platform survey | research-02 | `.agent/research/02-datagouv-platform-survey.md` | in_progress |
| Resource formats catalog | research-03 | `.agent/research/03-resource-formats-catalog.md` | in_progress |
| Harness & TS stack research | research-04 | `.agent/research/04-harness-engineering-and-ts-stack.md`, `.agent/AGENTS.md`, `.agent/rules/`, `.agent/skills/`, `.agent/exec-plans/`, `.agent/tech-debt/`, `.agent/journal/`, `.agent/decisions/`, `.agent/ownership.md` | done |
| Project scaffolding | orchestrator | `package.json`, `tsconfig.json`, `biome.json`, CI | pending |
| Core types & errors | — | `src/core/` | pending |
| API clients | — | `src/clients/` | pending |
| Format parsers | — | `src/formats/` | pending |
| MCP tools | — | `src/tools/` | pending |
| Server & transports | — | `src/server/` | pending |
| Test harness | — | `tests/`, `vitest.config.ts` | pending |
| Docker & deployment | — | `Dockerfile`, `docker-compose.yml` | pending |
| Architecture ADRs | architect | `.agent/decisions/` | pending |

**Status values**: `pending` · `in_progress` · `review` · `done` · `blocked`
