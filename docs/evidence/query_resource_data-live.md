# Evidence: query_resource_data (live stdio)

**Date**: 2026-09-03T16:55:43.924Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 208 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "query_resource_data",
  "arguments": {
    "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
    "page_size": 5
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `query_resource_data` present

## Output (text, truncated to 80 lines)

```text
Querying resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Dataset: Référentiel des gentilés des communes françaises (ID: 6a9899255369f45f95bdd226)

Total rows (Tabular API): 34946
Total pages: 6990 (page size: 5)
Retrieved: 5 row(s) from page 1
Columns: __id, code_insee, commune, departement, gentile

Data (5 rows):
  Row 1:
    __id: 1
    code_insee: 01001
    commune: L'Abergement-Clémenciat
    departement: 01
    gentile: 
  Row 2:
    __id: 2
    code_insee: 01002
    commune: L'Abergement-de-Varey
    departement: 01
    gentile: Abergementais, Abergementaises
  Row 3:
    __id: 3
    code_insee: 01004
    commune: Ambérieu-en-Bugey
    departement: 01
    gentile: Ambarrois, Ambarroises
  Row 4:
    __id: 4
    code_insee: 01005
    commune: Ambérieux-en-Dombes
    departement: 01
    gentile: Ambarrois, Ambarroises
  Row 5:
    __id: 5
    code_insee: 01006
    commune: Ambléon
    departement: 01
    gentile: Ambléonais, Ambléonaises

⚠️ Large dataset (34946 rows). To get all data, paginate using page=2 or use get_resource_info to retrieve the raw file URL and fetch it directly.
```

## structuredContent (keys)

- `resource_id`
- `resource_title`
- `dataset_id`
- `dataset_title`
- `total_pages`
- `columns`
- `rows`
- `total`
- `page`
- `page_size`
- `has_next`
- `truncated`

## Assertions

- [x] `tools/list` includes `query_resource_data`
- [x] Tool returned without `isError`
- [x] Text content present (1149 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `query_resource_data` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
