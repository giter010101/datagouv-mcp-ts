# TD-003: tsdown pinned to 0.21.x because the dev VM runs Node 22.14

**Status**: open
**Impact**: low
**Created**: 2026-09-03
**Owner**: unassigned (workstream E)

## Description

tsdown 0.22 requires Node ≥ 22.18; the Cloud Agent VM has 22.14.0, so 0.21.10 is pinned. 0.21 prints "Node.js v22.14.0 is deprecated" at build time. TypeScript is pinned to 5.9.3 although 7.0.x (native compiler) is published; Biome/vitest/tsdown support for TS 7 must be verified before upgrading.

## Impact

Build works, but the pin drifts from upstream; the warning is noise in CI logs.

## Proposed fix

- Bump the environment (`.cursor/environment.json` / Docker base) to Node 22.20+ (current 22 LTS) or 24 LTS, then `pnpm add -D tsdown@latest`.
- Evaluate TypeScript 7 once tsdown/vitest/Biome document support; keep `tsc --noEmit` semantics.
