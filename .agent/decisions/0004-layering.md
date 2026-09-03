# 0004: Enforced layering `core ← clients ← formats ← tools ← server`

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: orchestrator, architect

## Context

Several agents will develop in parallel in one worktree. Without hard boundaries, tool handlers start calling `fetch`, parsers import server config, and tests become untestable without network. Harness research (research/04) recommends structural invariants enforced by linters, not prose.

## Decision

| Layer | Responsibility | May import from |
|-------|----------------|-----------------|
| `src/core` | config, errors, logger, cache, http, text helpers, shared domain types | nothing above (npm deps only) |
| `src/clients` | one client per upstream service (udata v1/v2, Tabular, Metrics, Crawler, schema.data.gouv.fr/Validata); Zod schemas for raw payloads; return `core/types` | `core` |
| `src/formats` | capability detection, bounded download, per-format accessors, query engines | `core`, `clients` |
| `src/tools` | MCP tool definitions (schema, description, thin handler); output formatting | `core`, `clients`, `formats` |
| `src/server` | dependency composition, `McpServer` factory, transports, telemetry | everything below |
| `src/index.ts` | CLI entry | anything |

Rules:
1. No upward relative import. Enforced by `scripts/check-layers.ts` (`pnpm check:layers`) and `tests/unit/layering.test.ts` (runs on every `pnpm test`); CI fails on violations. The checker parses static and dynamic `import`/`export … from` specifiers.
2. Tool handlers never call `fetch`; they receive everything through `ToolContext.deps` (`ServerDeps`).
3. Cross-layer contracts are TypeScript interfaces placed in the **lower** layer (`clients/types.ts`, `formats/types.ts`), so upper layers depend on abstractions and tests can substitute fakes.
4. Files ≤ ~300 lines; one primary export; kebab-case filenames.

## Consequences

### Positive
- Parallel workstreams touch disjoint directories; each layer is unit-testable without the ones above.
- Violations are caught in seconds with an actionable message ("move the shared code down to X").

### Negative
- Occasional duplication of small helpers rather than importing upward; acceptable.

### Neutral
- `dependency-cruiser` was considered; a 90-line script with no extra dependency is sufficient for five layers and can be swapped later.
