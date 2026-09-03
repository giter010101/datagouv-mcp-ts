# Harness Engineering & TypeScript MCP Stack

Research for the data.gouv.fr MCP TypeScript rewrite.  
Sources: OpenAI "Harness engineering" (Feb 2026), MCP spec & TypeScript SDK (Sep 2026).

---

## 1. Harness Engineering Practices (OpenAI)

OpenAI's internal team shipped ~1M LOC in five months with **zero manually-written code** — humans design environments, agents execute. Key practices we adopt:

### AGENTS.md as a map, not an encyclopedia

- Keep `AGENTS.md` ≤ ~120 lines: table of contents + core rules + pointers.
- A monolithic instruction file fails: wastes context, nothing is prioritized, goes stale, cannot be linted.
- **Progressive disclosure**: agents start from a stable entry point and follow links.

### Docs as source of truth

- Structured `docs/` (or `.agent/`) is authoritative; agents update docs alongside code.
- Design docs indexed with verification status; architecture maps domains and layers.
- **Exec plans** are first-class living documents (goal, scope, milestones, decisions, progress log).
- CI + custom linters verify docs are current, cross-linked, and structured.
- Recurring **doc-gardening** agent finds stale docs and opens fix PRs.

### Agent legibility

- Everything the agent needs must live in the repo (no Slack/Docs-only knowledge).
- Optimize for agent reasoning: boring/stable tech, small modules, explicit boundaries.
- Expose runtime to agents: worktree-per-change, browser DevTools skills, local observability (logs/metrics queryable via CLI).

### Architectural enforcement

- Fixed layering with **custom linters + structural/invariant tests** (not just documentation).
- Validate data shapes at boundaries (Zod); inject fix instructions in linter error messages.
- File size limits, naming conventions, structured logging enforced statically.

### Agent-led QA

- Agents reproduce bugs via browser/CLI, validate fixes, produce evidence (screenshots/videos).
- Long-running agent loops (Ralph Wiggum): self-review → agent review → human review optional.
- Invariant tests guard critical behaviors.

### Throughput & entropy management

- Ephemeral PRs; follow-up fixes over long blocking reviews when agent throughput exceeds human attention.
- **Golden principles** encoded in repo; recurring garbage-collection PRs for AI drift.
- **Tech-debt tracker** with small, frequent paydown (like trash collection).
- Quality scores per domain tracked over time.

### Human role

- Set priorities, translate user feedback to acceptance criteria, validate outcomes.
- When agents fail → add missing capability (tool, doc, linter), never "just try harder."

---

## 2. TypeScript MCP — State of the Art (Sep 2026)

### Spec revisions

| Revision | Status | Notes |
|----------|--------|-------|
| **2025-11-25** | Stable, documented | Current default at modelcontextprotocol.io; Streamable HTTP, tools/resources/prompts, elicitation, sampling, tasks (experimental), progress, pagination, logging |
| **2026-07-28** | Newer wire format | Supported in SDK v2 beta; `serverInfo` in `_meta`, optional `clientInfo` in envelope |

### SDK packages (npm, Jul 2026)

| Package | Version | Role |
|---------|---------|------|
| `@modelcontextprotocol/sdk` | **1.30.0** | Stable v1 monolith — recommended starting point |
| `@modelcontextprotocol/server` + `@modelcontextprotocol/client` + `@modelcontextprotocol/core` | **2.0.0** (beta) | Modular v2; MCP 2026-07-28; CJS+ESM |
| `@modelcontextprotocol/inspector` | **2.5.0** | Interactive MCP testing UI |
| `@modelcontextprotocol/conformance` | **0.1.16** | Official conformance test harness (SDK devDep) |

**Recommendation**: Start on **SDK 1.30.0** (stable, well-documented). Plan migration path to v2 when GA.

### Core API patterns (v1)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const server = new McpServer({ name: "datagouv-mcp", version: "1.0.0" });

server.registerTool(
  "search_datasets",
  {
    title: "Search datasets",
    description: "Search data.gouv.fr datasets by keyword…",
    inputSchema: { query: z.string(), page: z.number().optional() },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async ({ query, page }) => {
    const results = await search(query, page ?? 1);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      structuredContent: results, // typed output for capable clients
    };
  },
);
```

### Transports

| Transport | Use case |
|-----------|----------|
| **Streamable HTTP** | Remote hosting (production: `https://mcp.data.gouv.fr/mcp`); stateful sessions or stateless mode |
| **stdio** | Local CLI / IDE subprocess integration |
| **HTTP+SSE** | Legacy only; provide backwards-compat if needed |

Streamable HTTP modes:
- **Stateful**: session tracking, server notifications via SSE, resumability (`InMemoryEventStore`).
- **Stateless**: simple API-style, no session.
- **JSON-only**: no SSE stream (limited notifications).

### Server capabilities

- **Tools**: `registerTool` with Zod inputSchema; `structuredContent` + optional `outputSchema`; tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- **Resources**: `registerResource`, `ResourceTemplate` with URI templates and completions.
- **Prompts**: `registerPrompt` with argument schemas.
- **Logging**: `server.sendLoggingMessage` to connected clients.
- **Progress**: report via `ctx.reportProgress` in long-running handlers.
- **Pagination**: cursor-based `list` operations.
- **Elicitation**: form (non-sensitive input) and URL (OAuth/API keys) modes.
- **Tasks** (experimental): long-running tool calls with poll/resume.
- **Sampling**: server asks client to run LLM completions.

### HTTP hosting patterns

| Framework | Pros | Cons |
|-----------|------|------|
| **Hono** | Lightweight, SDK has first-class adapter, edge-ready | Less ecosystem familiarity |
| **Express 5** | SDK ships examples; familiar | Heavier; SDK bundles it |
| **node:http** | Minimal deps; `toNodeHandler` from `@modelcontextprotocol/node` | Manual CORS/DNS-rebinding guards |

**Recommendation**: **Hono** for new server (SDK v2 has `@modelcontextprotocol/server` web-standard `fetch` handler + Hono adapter). For v1, use SDK's built-in Express/Hono examples. Apply host/origin validation and rate limiting.

### OAuth

- Optional; required only for protected deployments.
- SDK provides `requireBearerAuth`, OAuth metadata serving (RFC 9728/8414), PKCE, demo in-memory provider.
- data.gouv.fr public MCP is unauthenticated today — design OAuth as optional module.

### Testing tooling

- **MCP Inspector** (`npx @modelcontextprotocol/inspector`): interactive tool/resource/prompt testing.
- **Conformance** (`@modelcontextprotocol/conformance`): automated protocol compliance.
- **In-process SDK Client**: `Client` + `StreamableHTTPClientTransport` for e2e tests.

---

## 3. Recommended TypeScript Stack

### Runtime & toolchain

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 22.14 LTS | Current env; native fetch, Web Crypto, performance |
| **pnpm** | 10.33 | Fast, strict, workspace-friendly |
| **TypeScript** | 5.x strict (`7.0.2` latest) | Type safety at boundaries |
| **Module** | ESM-only (`"type": "module"`) | MCP SDK is ESM-native |
| **Bundler** | **tsdown** `0.22` (preferred) or tsup `8.5` | Fast ESM builds; tsdown used by MCP SDK v2 |
| **Test** | **vitest** `5.0` | Fast, native ESM, snapshot support |
| **Lint/format** | **Biome** `2.5` (preferred) or eslint+prettier | Single tool, fast; MCP SDK uses eslint |
| **Schema** | **zod** `4.5` | SDK peer dep; boundary validation |
| **Logging** | **pino** `10.3` | Structured JSON logs |
| **HTTP client** | native `fetch` + thin retry wrapper (undici `MockAgent` in tests) | No axios needed on Node 22 |
| **Cache** | `lru-cache` `11.5` in-memory + optional `keyv`/`flat-cache` disk | API response caching |

### Data parsing libraries

| Format | Library | Version | Notes |
|--------|---------|---------|-------|
| CSV | `csv-parse` | 7.0 | Streaming, Node-native; prefer over papaparse for server |
| CSV alt | `papaparse` | 5.7 | Browser-friendly; larger |
| XLSX | `exceljs` | 4.4 | Streaming read, no native deps; SheetJS (xlsx) is smaller but license concerns |
| Parquet | `hyparquet` | 4.4 | Pure JS, no native; good for metadata/preview |
| Parquet alt | `parquet-wasm` | 0.7 | WASM, faster reads; larger bundle |
| GeoJSON | native JSON | — | Parse with Zod schema |
| Shapefile | `shpjs` | 6.2 | Converts to GeoJSON; moderate size |

### SQL query engine (optional heavy dependency)

| Engine | Package | Install size | Pros | Cons |
|--------|---------|-------------|------|------|
| **DuckDB Node** | `@duckdb/node-api` `1.5.5-r.4` | ~50–80 MB native | Full SQL on CSV/Parquet/JSON/XLSX; fast; mature | Native binary, platform-specific, cold start |
| **DuckDB WASM** | `@duckdb/duckdb-wasm` | ~20 MB WASM | Portable, no native deps | Slower, memory limits, complex bundling |

**Recommendation**: 
- **Default path**: format-specific parsers (`csv-parse`, `hyparquet`, `exceljs`) for preview/metadata — matches current Python server scope.
- **Optional feature flag**: `@duckdb/node-api` behind `ENABLE_DUCKDB=1` for `query_resource_data` SQL mode; document install size trade-off.
- Use `duckdb-wasm` only if native binary deployment is blocked (e.g. certain serverless).

### Observability & ops

| Tool | Version | Role |
|------|---------|------|
| OpenTelemetry | `@opentelemetry/sdk-node` `0.222` | Traces + metrics |
| Sentry | `@sentry/node` `10.73` | Error tracking (Python server already uses Sentry) |
| Docker | multi-stage | `node:22-alpine` builder → slim runtime |
| Releases | `@changesets/cli` `3.0.1` | Version bumps + CHANGELOG |
| CI | GitHub Actions | lint → test → build → conformance → docker |

### Project layout (proposed)

```
src/
├── core/          # types, errors, config, invariants
├── clients/       # data.gouv API, tabular API, metrics, crawler
├── formats/       # CSV, XLSX, Parquet, GeoJSON parsers
├── tools/         # MCP tool handlers (thin, call clients/formats)
└── server/        # McpServer setup, transports, middleware
```

Layering: `core` ← `clients` ← `formats` ← `tools` ← `server` (no upward imports).

---

## 4. Testing Strategy — Proof of Function

### Pyramid

```
        ┌─────────────┐
        │ MCP e2e     │  SDK Client in-process
        ├─────────────┤
        │ Live smoke  │  data.gouv.fr (env-gated)
        ├─────────────┤
        │ Contract    │  Recorded fixtures + MSW/MockAgent
        ├─────────────┤
        │ Unit        │  vitest, parsers, schemas, errors
        └─────────────┘
```

### Unit tests (vitest)

- Zod schemas, error classes, parsers, truncation helpers, cache logic.
- Fast, no network; run on every commit.

### Contract tests

- Record HTTP fixtures from data.gouv.fr APIs (`tests/fixtures/`).
- Replay with **MSW** `2.15` (fetch interceptor) or **undici MockAgent**.
- Verify client parsing against real response shapes; re-record when APIs change.

### Live smoke tests

- Gated: `RUN_LIVE_TESTS=1` + optional API keys.
- Hit real endpoints; assert status codes and schema conformance.
- Run in CI nightly or pre-release, not every PR.

### MCP-level e2e

- Spin up `McpServer` in-process with `Client` over memory transport or Streamable HTTP loopback.
- Call each tool; assert `structuredContent` shape and content truncation.
- Run conformance suite (`@modelcontextprotocol/conformance`) in CI.

### Evidence reports

- Script: `pnpm evidence --tool search_datasets --query "population"`.
- Output: `docs/evidence/<tool>-<date>.md` with:
  - Input parameters
  - Actual tool call JSON
  - Truncated output (full output in `docs/evidence/raw/`)
  - Pass/fail assertion summary
- Agents produce evidence for every new/changed tool before marking exec-plan milestone done.

### CI pipeline (GitHub Actions)

```yaml
jobs:
  lint:    biome check
  test:    vitest --coverage
  build:   tsdown
  conform: mcp-conformance (against built server)
  docker:  build + smoke health endpoint
  live:    nightly, RUN_LIVE_TESTS=1
```

---

## 5. Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP SDK | `@modelcontextprotocol/sdk@1.30.0` | Stable; matches 2025-11-25 spec |
| Transport | Streamable HTTP (stateless prod) + stdio (dev) | Matches current deployment |
| HTTP framework | Hono | Lightweight, SDK-native adapter |
| Bundler | tsdown | MCP ecosystem alignment |
| Linter | Biome | Single tool, fast |
| Query engine | Optional `@duckdb/node-api` | Power vs install size trade-off |
| Test runner | vitest | ESM-native, fast |
| Evidence | Generated markdown in `docs/evidence/` | Agent-verifiable proof of function |
