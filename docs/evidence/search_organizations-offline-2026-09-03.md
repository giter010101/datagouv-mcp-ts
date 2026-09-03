# Evidence: search_organizations (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 3 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "query": "etalab",
  "page_size": 3
}
```

## Output (text, truncated)
```text
Found 23 organization(s) (query 'etalab')
Page 1 of results:

1. Etalab
   ID: 534fff75a3a7292c64a77de4
   Slug: etalab
   Badges: public-service, certified
   URL: https://www.data.gouv.fr/organizations/etalab

2. OpenDataFrance (ODF)
   ID: 59a47d0ec751df3ad11e2445
   Slug: association-opendatafrance
   Badges: public-service, certified
   URL: https://www.data.gouv.fr/organizations/association-opendatafrance

3. Assemblée nationale (AN)
   ID: 55819607c751df7bdda453b9
   Slug: assemblee-nationale
   Badges: public-service, certified
   URL: https://www.data.gouv.fr/organizations/assemblee-nationale

More results available: use page=2.
```

## structuredContent (keys)
- `query`
- `effective_query`
- `filters`
- `total`
- `page`
- `page_size`
- `has_next`
- `organizations`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (645 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
