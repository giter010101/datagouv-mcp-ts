# Coding Standards

## Language & module system

- **TypeScript 5.x** with `strict: true` in `tsconfig.json`.
- **ESM only** (`"type": "module"`); use `.ts` source, `.js` import extensions in compiled output.
- Target **Node 22** (`engines: { "node": ">=22" }`).
- No `any` — use `unknown` + Zod narrowing at boundaries.
- Prefer `const`; no default exports (named exports only).

## Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `dataset-client.ts` |
| Types/interfaces | PascalCase | `DatasetSummary` |
| Functions/vars | camelCase | `searchDatasets` |
| Constants | SCREAMING_SNAKE | `MAX_PAGE_SIZE` |
| Zod schemas | camelCase + `Schema` suffix | `searchInputSchema` |
| Error classes | PascalCase + `Error` | `ApiNotFoundError` |

## Error handling

- Typed error hierarchy in `src/core/errors.ts`:
  - `DatagouvError` (base)
  - `ValidationError`, `ApiError`, `FormatError`, `NotFoundError`, `RateLimitError`
- Each error: `code` (string enum), `message`, optional `cause`, `toJSON()` for structured logging.
- Never throw raw strings. Catch at tool boundary → map to MCP error response.
- Log errors with pino at `error` level; include `error.code` and request context.

## Zod at boundaries

- All MCP tool inputs: Zod schema → `inputSchema` in `registerTool`.
- All external API responses: Zod parse before use.
- Config/env: Zod schema in `src/core/config.ts`.

## Module size & structure

- Max ~300 lines per file; split when exceeded.
- One primary export per file preferred.
- Co-locate tests: `foo.ts` → `foo.test.ts` adjacent or in `tests/`.

## Architectural layering

```
server  →  tools  →  formats  →  clients  →  core
```

| Layer | Responsibility | May import |
|-------|---------------|------------|
| `core` | Types, errors, config, utils, cache interface | nothing above |
| `clients` | HTTP clients for data.gouv APIs | `core` |
| `formats` | CSV/XLSX/Parquet/GeoJSON parsing | `core`, `clients` (for fetch) |
| `tools` | MCP tool handlers (thin orchestration) | `core`, `clients`, `formats` |
| `server` | McpServer, transports, middleware | all below |

**Rule**: no upward imports. Enforced by custom lint rule or `dependency-cruiser` config.

## Logging

- Use `pino` child loggers per module: `const log = logger.child({ module: 'dataset-client' })`.
- Structured fields only; no string interpolation in log messages.
- Redact API keys and PII.

## Dependencies

- Prefer Node built-ins (`fetch`, `crypto`, `node:fs/promises`).
- Pin exact versions in `pnpm-lock.yaml`; use `pnpm add`.
- Document optional heavy deps (DuckDB) behind feature flags.
