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
