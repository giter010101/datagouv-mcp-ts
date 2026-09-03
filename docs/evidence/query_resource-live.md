# Evidence: query_resource (live stdio)

**Date**: 2026-09-03T16:59:29.305Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 219 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "query_resource",
  "arguments": {
    "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
    "page_size": 5
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `query_resource` present

## Output (text, truncated to 80 lines)

```text
Query on resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Access: tabular_api via tabular-api (mode: filters)

Rows: 5 of 34946 (page 1)

__id | code_insee | commune | departement | gentile
-----|------------|---------|-------------|--------
1 | 01001 | L'Abergement-Clémenciat | 01 | 
2 | 01002 | L'Abergement-de-Varey | 01 | Abergementais, Abergementaises
3 | 01004 | Ambérieu-en-Bugey | 01 | Ambarrois, Ambarroises
4 | 01005 | Ambérieux-en-Dombes | 01 | Ambarrois, Ambarroises
5 | 01006 | Ambléon | 01 | Ambléonais, Ambléonaises

More rows available: use page=2.
```

## structuredContent (keys)

- `resource_id`
- `title`
- `capability`
- `engine`
- `mode`
- `columns`
- `rows`
- `total`
- `page`
- `page_size`
- `has_next`
- `truncated`

## Assertions

- [x] `tools/list` includes `query_resource`
- [x] Tool returned without `isError`
- [x] Text content present (609 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `query_resource` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
