# Evidence: search_reuses (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 1 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataset_id": "53699d0ea3a729239d205b2e",
  "page_size": 3
}
```

## Output (text, truncated)
```text
Found 102 reuse(s) for dataset 53699d0ea3a729239d205b2e
Page 1 of results:

1. Zonelo - Trop ou pas assez de professionnels ? 
   ID: 6a96cc1b2aeed626b1cb300e
   Type: application (topic: economy_and_business)
   Organization: Zonelo
   Datasets used: 2
   URL: https://www.data.gouv.fr/reuses/zonelo-trop-ou-pas-assez-de-professionnels

2. PIctoStat - Datavisualisation Geoclip - DREAL Occitanie
   ID: 6a43bd4d6bda47715be1a401
   Type: application (topic: environment_and_energy)
   Datasets used: 2
   URL: https://www.data.gouv.fr/reuses/pictostat-datavisualisation-geoclip-dreal-occitanie

More results available: use page=2.
```

## structuredContent (keys)
- `query`
- `dataset_id`
- `total`
- `page`
- `page_size`
- `has_next`
- `reuses`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (630 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
