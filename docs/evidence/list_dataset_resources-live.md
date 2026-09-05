# Evidence: list_dataset_resources (live stdio)

**Date**: 2026-09-03T16:55:41.655Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 2 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "list_dataset_resources",
  "arguments": {
    "dataset_id": "53699d0ea3a729239d205b2e",
    "page_size": 8
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `list_dataset_resources` present

## Output (text, truncated to 80 lines)

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

6. Naissances, décès et mariages en 2017
   Resource ID: 410691ef-85cb-44af-8f1e-64800c7a7dfe
   Format: dbase
   Type: main
   URL: https://www.insee.fr/fr/statistiques/3596198
   Access: metadata_only → get_resource_info

7. Naissances, décès et mariages en 2016 
   Resource ID: 55f527ce-c756-4381-ae65-cb486aca8c82
   Format: html
   Type: main
   URL: https://www.insee.fr/fr/statistiques/3051496
   Access: document_preview → preview_resource

8. Séries chronologiques actives issues de la BDM
   Resource ID: 50070b85-c4d0-4a23-ab3f-0153d3faea28
   Format: html
   Type: main
   URL: https://www.insee.fr/fr/statistiques?debut=0&idprec=102928992&theme=0&categorie=10
   Access: document_preview → preview_resource
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

- [x] `tools/list` includes `list_dataset_resources`
- [x] Tool returned without `isError`
- [x] Text content present (2016 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `list_dataset_resources` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
