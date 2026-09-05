# Evidence: get_resource_schema (live stdio)

**Date**: 2026-09-03T16:59:25.947Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 2206 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_resource_schema",
  "arguments": {
    "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `get_resource_schema` present

## Output (text, truncated to 80 lines)

```text
Schema of resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Access: tabular_api via tabular-api

Columns (4, source: tabular-api) — rows: 34946:
  - code_insee: string [code_commune]
  - commune: string [commune]
  - departement: string
  - gentile: string

Next: query_resource with filters on these column names.
```

## structuredContent (keys)

- `resource_id`
- `title`
- `capability`
- `accessor`
- `schema`
- `next_tool`

## Assertions

- [x] `tools/list` includes `get_resource_schema`
- [x] Tool returned without `isError`
- [x] Text content present (357 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_resource_schema` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
