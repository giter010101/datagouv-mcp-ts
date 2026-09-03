# Skill: MCP Tool Authoring

Checklist for adding a new MCP tool to the data.gouv.fr server.

## Prerequisites

- [ ] Read `research/02-datagouv-platform-survey.md` for relevant API
- [ ] Check `ownership.md` — your workstream owns `src/tools/`
- [ ] Active exec-plan exists with this tool in milestones

## Steps

### 1. Define input schema (Zod)

```typescript
// src/tools/search-datasets.ts
import { z } from "zod";

export const searchDatasetsInputSchema = z.object({
  query: z.string().min(1).describe("Search keywords"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  page_size: z.number().int().min(1).max(100).default(20).optional(),
});
```

### 2. Write LLM-oriented description

- First sentence: what the tool does.
- Second: when to use it vs other tools.
- Mention return format, pagination, limits.
- Write for an LLM that has never seen data.gouv.fr.

### 3. Register tool

```typescript
server.registerTool(
  "search_datasets",
  {
    title: "Search datasets",
    description: "Search data.gouv.fr datasets by keyword…",
    inputSchema: searchDatasetsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async (input) => { /* handler */ },
);
```

### 4. Implement handler (thin)

- Parse input (already validated by SDK).
- Call `clients/` layer — no direct `fetch` in tool handler.
- Shape output with `structuredContent` for typed clients.
- Apply truncation for large results (configurable max bytes).

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
