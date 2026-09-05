# Evidence: list_dataset_resources (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 3 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataset_id": "53699d0ea3a729239d205b2e",
  "page_size": 5
}
```

## Output (text, truncated)
```text
Resources in dataset: Population
Dataset ID: 53699d0ea3a729239d205b2e
Total resources: 8

1. Les résultats des recensements de la population
   Resource ID: 4792c248-8b80-4524-8605-7d4213e49051
   Format: html
   Type: main
   URL: http://www.insee.fr/fr/bases-de-donnees/default.asp?page=recensements.htm
   Access: document_preview → preview_resource

2. Naissances, décès et mariages en 2021
   Resource ID: d2a15598-9573-4082-bacd-7c73504e7839
   Format: csv,dbase
   Type: main
   URL: https://www.insee.fr/fr/statistiques/6652160
   Access: remote_caution → check_resource_availability

3. Naissances, décès et mariages en 2020
   Resource ID: 1d9529f5-652e-4665-9e1d-30797dc6f0e6
   Format: csv,dbase
   Type: main
   URL: https://www.insee.fr/fr/statistiques/5419788
   Access: remote_caution → check_resource_availability

4. Naissances, décès et mariages en 2019
   Resource ID: 80cfc11c-f0c4-47c5-ad7a-67a2077692c8
   Format: dbase
   Type: main
   URL: https://www.insee.fr/fr/statistiques/4768339
   Access: metadata_only → get_resource_info

5. Naissances, décès et mariages en 2018
   Resource ID: 06d5fca0-da9f-4989-b4e8-6b30c31c16ab
   Format: csv, dbase
   Type: main
   URL: https://www.insee.fr/fr/statistiques/4215184
   Access: remote_caution → check_resource_availability

More resources available: use page=2.
```

## structuredContent (keys)
- `dataset_id`
- `dataset_title`
- `total`
- `page`
- `page_size`
- `has_next`
- `resources`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1333 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
