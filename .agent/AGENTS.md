# AGENTS.md — data.gouv.fr MCP TypeScript Rewrite

Short map for agents. **Read this first**, then follow links. Do not treat this file as an encyclopedia.

## Project

Rewrite the Python MCP server (`main.py`, `tools/`, `helpers/`) into a state-of-the-art TypeScript MCP server for [data.gouv.fr](https://www.data.gouv.fr).

Branch: `cursor/datagouv-mcp-typescript-refonte-57e0`

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

## Repo layout (target)

```
src/
├── core/       # types, errors, config
├── clients/    # data.gouv API clients
├── formats/    # CSV, XLSX, Parquet parsers
├── tools/      # MCP tool handlers
└── server/     # McpServer, transports
tests/
docs/
  └── evidence/ # generated proof-of-function reports
```

## Stack (summary)

Node 22 LTS · pnpm 10 · TypeScript 5 strict · ESM · `@modelcontextprotocol/sdk@1.30.0` · zod 4 · vitest · biome · pino · Hono · tsdown

Full details: `research/04-harness-engineering-and-ts-stack.md`

## Quick start for dev agents

1. Read your workstream in `ownership.md`.
2. Read relevant research docs.
3. Check `exec-plans/active/` for your plan; create one from `TEMPLATE.md` if none exists.
4. Implement in assigned `src/` directories respecting layering.
5. Write tests + evidence report.
6. Log session in `journal/`.
7. Update exec-plan milestones and ownership status.
