# Evidence: preview_resource (live stdio)

**Date**: 2026-09-03T16:55:44.132Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 2 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "preview_resource",
  "arguments": {
    "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
    "limit": 5
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `preview_resource` present

## Output (text, truncated to 80 lines)

```text
Preview of resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Access: tabular_api via tabular-api

Columns (5): __id, code_insee, commune, departement, gentile
Rows shown: 5 of 34946

__id | code_insee | commune | departement | gentile
-----|------------|---------|-------------|--------
1 | 01001 | L'Abergement-Clémenciat | 01 | 
2 | 01002 | L'Abergement-de-Varey | 01 | Abergementais, Abergementaises
3 | 01004 | Ambérieu-en-Bugey | 01 | Ambarrois, Ambarroises
4 | 01005 | Ambérieux-en-Dombes | 01 | Ambarrois, Ambarroises
5 | 01006 | Ambléon | 01 | Ambléonais, Ambléonaises

Facts:
  source: tabular-api
  total: 34946
  tabularApi: https://tabular-api.data.gouv.fr/api/resources/a86ebc34-a979-4d6c-8f2a-9710a43dca93/

Next: query_resource.
```

## structuredContent (keys)

- `resource_id`
- `title`
- `capability`
- `accessor`
- `kind`
- `table`
- `facts`
- `notes`
- `next_tool`

## Assertions

- [x] `tools/list` includes `preview_resource`
- [x] Tool returned without `isError`
- [x] Text content present (786 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `preview_resource` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
