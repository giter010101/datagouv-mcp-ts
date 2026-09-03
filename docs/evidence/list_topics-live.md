# Evidence: list_topics (live stdio)

**Date**: 2026-09-03T16:59:28.836Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 265 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "list_topics",
  "arguments": {
    "query": "",
    "page_size": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `list_topics` present

## Output (text, truncated to 80 lines)

```text
Found 229 topic(s)
Page 1 of results:

1. Hackathon "Le climat en données"
   ID: 6914ef53fd557dbff00e4387
   Description: Le hackathon “Le climat en données” est un événement de 4 demi-journées (du 2 décembre après-midi au 4 décembre matin) pendant lequel il s’agira :
* **d’explorer de nouvelles données de projections...
   Tags: hackathon, climat
   URL: https://www.data.gouv.fr/topics/hackathon-le-climat-en-donnees/

2. Exemple de bouquet
   ID: 68f8f7b12bcd6978f06511b1
   Description: Pour illustrer le fonctionnement des bouquets
   Tags: culture
   URL: https://www.data.gouv.fr/topics/exemple-de-bouquet/

3. Portail des aides entreprises
   ID: 68da783cbea0bfd0f9395a6e
   Description: -
   Tags: simplifions-v2, simplifions-v2-dag-generated, simplifions-v2-solutions, simplifions-v2-solutions-78, simplifions-v2-categorie-de-solution-logiciel-metier
   URL: https://www.data.gouv.fr/topics/portail-des-aides-entreprises-1/

More results available: use page=2.
```

## structuredContent (keys)

- `query`
- `total`
- `page`
- `page_size`
- `has_next`
- `topics`

## Assertions

- [x] `tools/list` includes `list_topics`
- [x] Tool returned without `isError`
- [x] Text content present (973 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `list_topics` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
