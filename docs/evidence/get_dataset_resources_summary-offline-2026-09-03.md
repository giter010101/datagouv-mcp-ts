# Evidence: get_dataset_resources_summary (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataset_id": "53699d0ea3a729239d205b2e"
}
```

## Output (text, truncated)
```text
Dataset: Population
ID: 53699d0ea3a729239d205b2e (slug: population)
Organization: Institut national de la statistique et des études économiques (Insee)
Description: Ce jeu de données permet d'accéder aux résultats des recensements de la population, à des séries chronologiques de la Banque de Données Macro-économiques de l'Insee sur le thème de la population et...
License: fr-lo
Last update: 2026-08-19T10:27:05.636000+00:00
URL: https://www.data.gouv.fr/datasets/population/

Resources: 8 (main: 8, documentation: 0)
Latest file modification: 2026-08-19T10:27:05.636842+00:00

By format family:
  - document: 3 file(s), formats html
  - unknown: 5 file(s), formats csv,dbase/dbase/csv, dbase

Start with: "Les résultats des recensements de la population" (resource_id=4792c248-8b80-4524-8605-7d4213e49051) → preview_resource. Main data resource with the strongest access path (document_preview).

Resources:
  1. Les résultats des recensements de la population [html] id=4792c248-8b80-4524-8605-7d4213e49051 → document_preview (preview_resource)
  2. Naissances, décès et mariages en 2021 [csv,dbase] id=d2a15598-9573-4082-bacd-7c73504e7839 → remote_caution (check_resource_availability)
  3. Naissances, décès et mariages en 2020 [csv,dbase] id=1d9529f5-652e-4665-9e1d-30797dc6f0e6 → remote_caution (check_resource_availability)
  4. Naissances, décès et mariages en 2019 [dbase] id=80cfc11c-f0c4-47c5-ad7a-67a2077692c8 → metadata_only (get_resource_info)
  5. Naissances, décès et mariages en 2018 [csv, dbase] id=06d5fca0-da9f-4989-b4e8-6b30c31c16ab → remote_caution (check_resource_availability)
  6. Naissances, décès et mariages en 2017 [dbase] id=410691ef-85cb-44af-8f1e-64800c7a7dfe → metadata_only (get_resource_info)
  7. Naissances, décès et mariages en 2016  [html] id=55f527ce-c756-4381-ae65-cb486aca8c82 → document_preview (preview_resource)
  8. Séries chronologiques actives issues de la BDM [html] id=50070b85-c4d0-4a23-ab3f-0153d3faea28 → document_preview (preview_resource)
```

## structuredContent (keys)
- `dataset`
- `resources_total`
- `main_resources`
- `documentation_resources`
- `latest_modification`
- `groups`
- `recommended`
- `resources`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1995 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
