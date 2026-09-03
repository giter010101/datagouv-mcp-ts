# AGENTS.md — data.gouv.fr MCP TypeScript Rewrite

Short map for agents. **Read this first**, then follow links. Do not treat this file as an encyclopedia.

## Project

Rewrite the Python MCP server (now frozen under `legacy/python/`) into a state-of-the-art TypeScript MCP server for [data.gouv.fr](https://www.data.gouv.fr). The TypeScript package lives at the repo root.

Branch: `cursor/datagouv-mcp-typescript-refonte-57e0`

**Master plan**: `exec-plans/001-typescript-rewrite.md` (architecture, tool catalogue, milestones, workstreams A–E). **Decisions**: `decisions/0001`–`0010`.

## Toolchain (must be green before you commit)

`pnpm check` = `pnpm typecheck && pnpm lint && pnpm check:layers && pnpm test && pnpm build`.
Other: `pnpm test:live` (real API, `RUN_LIVE_TESTS=1`), `pnpm evidence --tool <name> --input '<json>' [--stdio]`, `pnpm dev` / `pnpm dev:http`.

## Core rules

1. **Check before you start**: read `ownership.md`, scan `exec-plans/active/`, and recent `journal/` entries. Never duplicate work.
2. **Docs are source of truth**: update docs when you change behavior. Stale docs are bugs.
3. **Write in `.agent/` and new `src/` only** unless your workstream owns legacy files. Do not edit concurrent research files (`research/01–03`).
4. **One logical change per commit**; conventional commits; CHANGELOG entry per user-facing change.
5. **Run tests** before marking work done. Produce evidence reports for tools (see `skills/writing-evidence-report.md`).
6. **Respect layering** (see `rules/coding-standards.md`): `core` ← `clients` ← `formats` ← `tools` ← `server`.
7. **Log your session** in `journal/YYYY-MM-DD-<agent>-<topic>.md` when finishing significant work.
8. **Escalate blockers** in exec-plan open questions or tech-debt, not in Slack-only knowledge.

## Folder map

| Path | Purpose |
|------|---------|
| `AGENTS.md` | This file — entry point |
| `ownership.md` | Who owns what (orchestrator maintains) |
| `research/` | Background research (read-only once published) |
| `rules/` | Coding, docs, git, testing standards |
| `skills/` | How-to checklists for common tasks |
| `exec-plans/` | Living design docs for active work |
| `tech-debt/` | Tracked debt items |
| `journal/` | Per-session progress logs |
| `decisions/` | Architecture Decision Records (ADRs) |

## Research (wave 1)

| Doc | Topic |
|-----|-------|
| `research/01-existing-python-mcp-audit.md` | Current Python server audit |
| `research/02-datagouv-platform-survey.md` | data.gouv.fr APIs & platform |
| `research/03-resource-formats-catalog.md` | Supported data formats |
| `research/04-harness-engineering-and-ts-stack.md` | Harness practices + TS stack |

## Rules

- `rules/coding-standards.md` — TS strict, ESM, layering, errors
- `rules/documentation.md` — what to document where
- `rules/git-workflow.md` — branches, commits, PRs
- `rules/testing-and-evidence.md` — test pyramid, evidence reports

## Skills (how-to)

- `skills/mcp-tool-authoring.md` — add a new MCP tool
- `skills/datagouv-api-usage.md` — API client patterns (→ research/02)
- `skills/writing-evidence-report.md` — proof-of-function reports
- `skills/release.md` — release process (TBD)

## Active work tracking

- **Exec plans**: `exec-plans/README.md` + `exec-plans/active/` (create when work starts)
- **Tech debt**: `tech-debt/README.md`
- **ADRs**: `decisions/README.md`
- **Ownership**: `ownership.md`

## Repo layout (current)

```
src/
├── index.ts    # CLI (stdio default, --http)
├── core/       # config, errors, logger, cache, http, text, types, version
├── clients/    # data.gouv API clients (types.ts = contracts, schemas/ = Zod)
├── formats/    # capability detection, ResourceAccessor registry, engines
├── tools/      # ToolDefinition + registry adapter, one file per tool
└── server/     # deps composition, McpServer factory, stdio, http (Hono)
tests/          # unit · e2e (in-memory + HTTP) · live (gated) · fixtures · helpers
scripts/        # check-layers.ts, evidence.ts
docs/evidence/  # generated proof-of-function reports
legacy/python/  # frozen reference, deleted at parity
```

## Stack (summary)

Node 22 LTS · pnpm 10 · TypeScript 5.9 strict · ESM · `@modelcontextprotocol/sdk@1.30.0` · zod 4 · vitest 5 · biome 2 · pino · Hono · tsdown 0.21 (ADR 0002)

Full details: `research/04-harness-engineering-and-ts-stack.md`

## Quick start for dev agents

1. Read your workstream row in `ownership.md` and §12 of `exec-plans/001-typescript-rewrite.md`.
2. Read relevant research docs and the ADRs your work touches.
3. Create `exec-plans/active/ws-<letter>-<topic>.md` from `TEMPLATE.md` (one per workstream).
4. Code against the shared contracts (`src/clients/types.ts`, `src/formats/types.ts`, `src/tools/types.ts`, `src/core/types.ts`) in your owned directories only; respect layering.
5. `pnpm check` green + evidence report for every tool.
6. Log session in `journal/`; tick milestones in the master plan; add tech-debt items you leave.
