# Architecture Decision Records (ADRs)

Document significant architectural decisions. Written by the architect agent.

## Format

Filename: `NNNN-<kebab-case-title>.md` (sequential numbering: 0001, 0002, …)

```markdown
# NNNN: <title>

**Status**: proposed | accepted | deprecated | superseded by NNNN
**Date**: YYYY-MM-DD
**Deciders**: architect, orchestrator

## Context

What is the issue? What forces are at play?

## Decision

What did we decide?

## Consequences

### Positive
- …

### Negative
- …

### Neutral
- …
```

## When to write an ADR

- Choice of MCP SDK version or transport
- Layering or module boundary decisions
- Optional dependency strategy (DuckDB)
- Caching, auth, deployment architecture
- Anything hard to reverse

## When NOT to write an ADR

- Routine tool implementation details
- Dependency version bumps
- Test or docs-only changes

## Template

Copy this structure for new ADRs. No separate template file needed.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| `0001-package-at-root-legacy-move.md` | TS package at repo root; Python moved to `legacy/python/` | accepted |
| `0002-stack-choices.md` | Node 22, pnpm, TS 5.9 strict ESM, SDK 1.30, vitest 5, Biome 2, tsdown 0.21, pino | accepted |
| `0003-http-framework-and-transports.md` | Hono + web-standard Streamable HTTP (stateless), stdio default, host/origin guard | accepted |
| `0004-layering.md` | `core ← clients ← formats ← tools ← server`, enforced by `check-layers` | accepted |
| `0005-zod-version.md` | Zod 4 only; raw shapes for tool inputs; loose objects for APIs | accepted |
| `0006-optional-duckdb-engine.md` | `QueryEngine` interface; DuckDB optional (`ENABLE_DUCKDB`), pure-JS fallback | accepted |
| `0007-tool-naming-and-compat.md` | Legacy tool names/params frozen; naming grammar for new tools | accepted |
| `0008-output-shaping-policy.md` | text + `structuredContent`, `MAX_OUTPUT_CHARS`, errors as `isError` results | accepted |
| `0009-caching-and-http-policy.md` | Shared HttpClient (timeout/retry), LRU cache TTLs, download limits | accepted |
| `0010-testing-and-evidence-strategy.md` | Test pyramid, fixtures via `fetchImpl`, live gating, evidence reports | accepted |
