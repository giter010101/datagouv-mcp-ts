# 0001: TypeScript package at repository root; legacy Python moved to `legacy/python/`

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: orchestrator, architect

## Context

The repository (`datagouv-mcp-ts`) held the Python server at its root (`main.py`, `tools/`, `helpers/`, `pyproject.toml`, CircleCI, Docker). The rewrite must be published as an npm package (`datagouv-mcp`, bin `datagouv-mcp`) and remain easy to consume with `npx`. Two implementations at the root would confuse tooling (Dockerfile, CI, `.gitignore`) and agents.

## Decision

- The TypeScript package lives at the **repository root** (`package.json`, `src/`, `tests/`, `scripts/`).
- The Python implementation is moved **unchanged** with `git mv` to `legacy/python/` (including its CircleCI config, Dockerfile, docker-compose, `.env.example`, `uv.lock`, `tag_version.sh`, pre-commit config). It is reference material for parity (research/01) and is neither built nor released.
- Root keeps `LICENSE`, `README.md` (rewritten by workstream E), `CHANGELOG.md` (new `[Unreleased]` section on top, legacy history under "Python (legacy) history"), `.github/`.
- `legacy/python/` is deleted once milestone M3 (tool parity, evidence for all 10 tools) is reached.

## Consequences

### Positive
- Single toolchain at root; `npx datagouv-mcp` works; CI/Docker unambiguous.
- Behavioural reference stays greppable in the same worktree during the port.

### Negative
- Git history for Python files continues under new paths (rename detection keeps `git log --follow` usable).
- `legacy/python/` must be excluded from Biome/tsconfig/vitest (done).

### Neutral
- The old GitHub Actions contribution-reminder workflow remains under `.github/`.
