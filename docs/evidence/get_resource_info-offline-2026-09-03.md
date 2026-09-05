# Evidence: get_resource_info (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 7 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93"
}
```

## Output (text, truncated)
```text
Resource Information: Gentilés des communes françaises

Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
Format: csv
MIME type: text/csv
Type: main
File type: remote
Last modified: 2026-09-02T21:46:13.912000+00:00

URL: https://www.habitants.fr/api/export-gentiles.php
Stable URL: https://www.data.gouv.fr/api/1/datasets/r/a86ebc34-a979-4d6c-8f2a-9710a43dca93

Description: Fichier de référence des gentilés des communes françaises recensés et documentés par Habitants. Le jeu de données comprend le code INSEE de la commune, son nom, son département et le gentilé recensé. Une valeur vide dans le champ « gentile » signifie qu'aucun gentilé n'est actuellement documenté dans la base. Les données sont générées directement depuis la base et mises à jour au fil de son enrichissement.


Dataset ID: 6a9899255369f45f95bdd226
Dataset: Population

Tabular API availability:
✅ Available via Tabular API (can be queried)

Access capabilities:
  Primary: tabular_api (format family: tabular, detected format: csv)
  All: tabular_api, parquet, stream_parse, metadata_only
  Tabular API probe: available
  Recommended next tool: query_resource — Rows are served by the Tabular API: filter, sort and paginate without downloading (query_resource or legacy query_resource_data).
  Parquet URL: https://hydra.s3.rbx.io.cloud.ovh.net/parquet/a86ebc34-a979-4d6c-8f2a-9710a43dca93.parquet
  Tabular API URL: https://tabular-api.data.gouv.fr/api/resources/a86ebc34-a979-4d6c-8f2a-9710a43dca93/
```

## structuredContent (keys)
- `resource`
- `tabular_api`
- `capability`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1477 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
