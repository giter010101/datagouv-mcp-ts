# Skill: MCP Tool Authoring

Checklist for adding a new MCP tool to the data.gouv.fr server.

## Prerequisites

- [ ] Read `research/02-datagouv-platform-survey.md` for relevant API
- [ ] Check `ownership.md` — your workstream owns `src/tools/`
- [ ] Active exec-plan exists with this tool in milestones

## Steps

### 1. Define input schema (Zod raw shape, not `z.object`)

```typescript
// src/tools/search-datasets.ts
import { z } from "zod";

export const searchDatasetsInputShape = {
  query: z.string().min(1).describe("Search keywords"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  page_size: z.number().int().min(1).max(100).default(20).describe("Results per page (max 100)"),
};
```

### 2. Write LLM-oriented description

- First sentence: what the tool does.
- Second: when to use it vs other tools.
- Mention return format, pagination, limits.
- Write for an LLM that has never seen data.gouv.fr.

### 3. Define the tool (reference implementation: `src/tools/search-datasets.ts`)

```typescript
// src/tools/<tool-name>.ts
export const myToolInputShape = { /* zod raw shape, every field .describe()d */ };

export const myTool = defineTool<typeof myToolInputShape, MyToolDeps>({
  name: "get_dataset_info",            // legacy name frozen (ADR 0007)
  title: "Get dataset info",
  description: "…LLM-oriented…",
  inputSchema: myToolInputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const dataset = await ctx.deps.datagouv.getDataset(input.dataset_id);
    return { text: formatDataset(dataset), structured: { …snake_case… }, howToGetMore: "…" };
  },
});
```

Then append it to `ALL_TOOLS` in `src/tools/index.ts` (legacy order first). `tools/registry.ts` does the SDK
registration, logging, error → `isError` mapping and output capping for you.

### 4. Implement handler (thin)

- Input is already validated by the SDK; never re-parse.
- Call `ctx.deps.*` (clients / formats) — no direct `fetch` in tool handlers (layering check fails otherwise).
- Throw `DatagouvError` subclasses (`NotFoundError` with the legacy message, etc.); never return ad-hoc error strings.
- Return `{ text, structured, howToGetMore }`; the registry applies `MAX_OUTPUT_CHARS` (ADR 0008).

### 5. Output shaping

- Return `{ content: [...], structuredContent: {...} }`.
- Text content: JSON.stringify with 2-space indent, truncated.
- Include pagination metadata when applicable.
- Map errors to MCP error responses (not thrown exceptions).

### 6. Tests

- [ ] Unit test: input validation edge cases
- [ ] Contract test: client layer with fixtures
- [ ] MCP e2e test: in-process tool call
- [ ] Error path tests (404, timeout, invalid format)

### 7. Evidence report

```bash
pnpm evidence --tool search_datasets --input '{"query":"population"}'
```

- [ ] Report in `docs/evidence/`
- [ ] All assertions pass

### 8. Documentation

- [ ] Update exec-plan milestone checkbox
- [ ] Log session in `journal/`
- [ ] Update `ownership.md` status if workstream complete

## Annotations guide

| Annotation | When |
|------------|------|
| `readOnlyHint: true` | Search, get, list operations |
| `destructiveHint: false` | Never destructive (this server is read-only) |
| `openWorldHint: true` | Queries external APIs |
| `idempotentHint: true` | Same input → same output (most tools) |

## Anti-patterns

- ❌ Direct `fetch` in tool handler
- ❌ Returning unbounded large payloads
- ❌ Generic descriptions ("searches data")
- ❌ Missing error handling for API failures
- ❌ Skipping evidence report
