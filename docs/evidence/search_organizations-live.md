# Evidence: search_organizations (live stdio)

**Date**: 2026-09-03T16:55:40.605Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 867 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "search_organizations",
  "arguments": {
    "query": "etalab",
    "page_size": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `search_organizations` present

## Output (text, truncated to 80 lines)

```text
Found 23 organization(s) (query 'etalab')
Page 1 of results:

1. Etalab
   ID: 534fff75a3a7292c64a77de4
   Slug: etalab
   Badges: public-service, certified
   Metrics: datasets=47, reuses=29, followers=359, views=466952
   URL: https://www.data.gouv.fr/organizations/etalab

2. OpenDataFrance (ODF)
   ID: 59a47d0ec751df3ad11e2445
   Slug: association-opendatafrance
   Badges: public-service, certified
   Metrics: datasets=6, reuses=3, followers=10, views=27938
   URL: https://www.data.gouv.fr/organizations/association-opendatafrance

3. Assemblée nationale (AN)
   ID: 55819607c751df7bdda453b9
   Slug: assemblee-nationale
   Badges: public-service, certified
   Metrics: datasets=11, reuses=0, followers=24, views=82347
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

- [x] `tools/list` includes `search_organizations`
- [x] Tool returned without `isError`
- [x] Text content present (830 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `search_organizations` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
