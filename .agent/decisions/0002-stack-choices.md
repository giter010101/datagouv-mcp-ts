# 0002: Runtime and toolchain stack

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: orchestrator, architect

## Context

research/04 surveyed the TypeScript MCP ecosystem (Sep 2026). Versions were verified with `npm view` on 2026-09-03 before pinning. The dev VM runs Node 22.14.

## Decision

| Concern | Choice | Pinned | Notes |
|---------|--------|--------|-------|
| Runtime | Node.js 22 LTS | `engines: >=22`, `.nvmrc` 22 | native `fetch`, `AbortSignal.any`, `parseArgs` |
| Package manager | pnpm | 10.33.3 (`packageManager`) | single package, no workspace |
| Language | TypeScript strict, ESM only | 5.9.3 | TS 7.0 (native compiler) exists but toolchain support is not yet uniform → stay on 5.9 |
| `tsconfig` | `module: NodeNext`, `target: ES2022`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess` | — | `.js` extensions in imports |
| MCP SDK | `@modelcontextprotocol/sdk` | 1.30.0 | latest stable 1.x; v2 is beta (ADR revisit when GA) |
| Validation | zod | 4.5.4 | see ADR 0005 |
| Tests | vitest (+ `@vitest/coverage-v8`) | 5.0.0 | requires Node ≥ 22.12 |
| Lint/format | Biome | 2.5.12 | one tool; `noExplicitAny`, `noDefaultExport`, `useImportType` as errors |
| Bundler | tsdown | 0.21.10 | 0.22 requires Node ≥ 22.18 (VM has 22.14) → TD-003; single ESM bundle `dist/index.js` with shebang |
| Logging | pino | 10.3.1 | JSON to stderr |
| HTTP server | Hono + `@hono/node-server` | 4.13.5 / 2.1.1 | see ADR 0003 |
| HTTP client | global `fetch` (undici) wrapped in `core/http.ts` | — | `undici` 8.10.1 dev-only for `MockAgent` |
| Cache | lru-cache | 11.5.2 | see ADR 0009 |
| Dev runner | tsx | 4.23.13 | `pnpm dev`, scripts |
| Optional engine | `@duckdb/node-api` | 1.5.5-r.4 (not installed yet) | see ADR 0006 |

Format libraries (workstream B adds with `pnpm add`, exact versions): `csv-parse`, `exceljs` (or SheetJS if ODS needed), `hyparquet`, `fast-xml-parser`, `yauzl`, `pdf-parse`, `@tmcw/togeojson`, `yaml` (OpenAPI specs).

## Consequences

### Positive
- Everything ESM-native and fast; one config file per tool; deterministic versions.

### Negative
- tsdown prints a deprecation warning on Node 22.14; upgrading the VM to ≥ 22.18 unlocks 0.22.
- Biome rules differ from the MCP SDK's eslint conventions; irrelevant for consumers.

### Neutral
- `pnpm check` runs typecheck → lint → layers → tests → build; CI mirrors it.
