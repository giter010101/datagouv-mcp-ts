# Testing & Evidence

## Test pyramid

| Level | Tool | When | Network |
|-------|------|------|---------|
| Unit | vitest | Every commit | No |
| Contract | vitest + MSW/MockAgent | Every commit | Fixtures only |
| MCP e2e | vitest + SDK Client | Every commit | In-process |
| Conformance | `@modelcontextprotocol/conformance` | CI | In-process |
| Live smoke | vitest | Nightly / pre-release | Yes (env-gated) |

## Unit tests

- Test: Zod schemas, error mapping, parsers, truncation, cache logic.
- Location: adjacent `*.test.ts` or `tests/unit/`.
- Fast (< 5s total for unit suite).

## Contract tests

- Record real API responses in `tests/fixtures/<api>/<endpoint>.json`.
- Replay with MSW or undici `MockAgent`.
- Re-record when API shapes change (note in CHANGELOG).

## MCP e2e tests

- Start `McpServer` in-process; connect `Client` via memory or loopback HTTP.
- Call each tool with known inputs; assert `structuredContent` shape.
- Test error paths (invalid input, API 404, timeout).

## Live smoke tests

- Gated: `RUN_LIVE_TESTS=1`.
- File: `tests/live/*.test.ts`.
- Skip in default CI; run nightly workflow.
- Assert: HTTP 200, response matches Zod schema, no unhandled errors.

## Evidence reports

Required for every new or changed MCP tool.

### Format

`docs/evidence/<tool-name>-<YYYY-MM-DD>.md`:

```markdown
# Evidence: search_datasets

**Date**: 2026-09-03
**Agent**: dev-tools-01
**Status**: PASS

## Input
\`\`\`json
{ "query": "population", "page": 1 }
\`\`\`

## Output (truncated)
\`\`\`json
{ ... first 50 lines ... }
\`\`\`

## Assertions
- [x] Returns array of datasets
- [x] Each item has `id`, `title`, `url`
- [x] Pagination metadata present
- [x] Response under 50KB after truncation

## Full output
See `docs/evidence/raw/search_datasets-2026-09-03.json`
```

### Generation

```bash
pnpm evidence --tool search_datasets --input '{"query":"population"}'
```

### Rules

- Evidence must use **actual tool execution**, not mocked data.
- Truncate large outputs; store full in `docs/evidence/raw/`.
- Attach evidence path in PR description.
- Re-generate when tool behavior changes.

## Coverage targets

- `core/`, `clients/`, `formats/`: ≥ 90% line coverage.
- `tools/`: 100% tool handlers have e2e test + evidence.
- `server/`: transport setup + health endpoint tested.
