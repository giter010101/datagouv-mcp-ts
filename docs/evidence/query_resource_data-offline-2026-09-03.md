# Evidence: query_resource_data (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 4 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  "page_size": 5
}
```

## Output (text, truncated)
```text
Querying resource: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Dataset: Population (ID: 6a9899255369f45f95bdd226)

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
… (2 more lines)
```

## structuredContent (keys)
- `resource_id`
- `resource_title`
- `dataset_id`
- `dataset_title`
- `filter`
- `sort`
- `total_pages`
- `columns`
- `rows`
- `total`
- `page`
- `page_size`
- `has_next`
- `truncated`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1111 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
