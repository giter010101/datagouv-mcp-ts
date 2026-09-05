# Evidence: search_reuses (live stdio)

**Date**: 2026-09-03T16:59:28.154Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 257 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "search_reuses",
  "arguments": {
    "query": "population",
    "page_size": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `search_reuses` present

## Output (text, truncated to 80 lines)

```text
Found 56 reuse(s) for query 'population'
Page 1 of results:

1. POPULATION
   ID: 5b7e8a8d8b4c4126662ea070
   Type: visualization (topic: society_and_demography)
   Organization: Ville de Garges-lès-Gonesse
   Datasets used: 0
   URL: https://www.data.gouv.fr/reuses/population

2. Population Paris 
   ID: 643f4940e3bcb66dbcd10f25
   Type: visualization (topic: society_and_demography)
   Datasets used: 1
   URL: https://www.data.gouv.fr/reuses/population-paris

3. Population de guilers
   ID: 5cf36255634f4156181fe9a6
   Type: visualization (topic: society_and_demography)
   Datasets used: 0
   URL: https://www.data.gouv.fr/reuses/population-de-guilers

More results available: use page=2.
```

## structuredContent (keys)

- `query`
- `total`
- `page`
- `page_size`
- `has_next`
- `reuses`

## Assertions

- [x] `tools/list` includes `search_reuses`
- [x] Tool returned without `isError`
- [x] Text content present (695 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `search_reuses` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
