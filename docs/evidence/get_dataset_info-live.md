# Evidence: get_dataset_info (live stdio)

**Date**: 2026-09-03T16:55:41.472Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 182 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_dataset_info",
  "arguments": {
    "dataset_id": "53699d0ea3a729239d205b2e"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `get_dataset_info` present

## Output (text, truncated to 80 lines)

```text
Dataset Information: Population

ID: 53699d0ea3a729239d205b2e
Slug: population
URL: https://www.data.gouv.fr/datasets/population/

Description: Ce jeu de données permet d'accéder aux résultats des recensements de la population, à des séries chronologiques de la Banque de Données Macro-économiques de l'Insee sur le thème de la population et à d'autres données issues notamment des statistiques de l'état civil. Le recensement de la populati...

Full description: Ce jeu de données permet d'accéder aux résultats des recensements de la population, à des séries chronologiques de la Banque de Données Macro-économiques de l'Insee sur le thème de la population et à d'autres données issues notamment des statistiques de l'état civil. 

Le recensement de la population permet de connaître la diversité et l'évolution de la population de la France. L'Insee fournit ainsi des statistiques sur les habitants et les logements, leur nombre et leurs caractéristiques : r...

Organization: Institut national de la statistique et des études économiques (Insee)
  Organization ID: 534fff81a3a7292c64a77e5c

Tags: deces, demographie, etat-civil, famille, mariages, menages, naissances, population, recensement

Resources: 8 file(s)

Created: 2013-08-23T08:43:28.560000+00:00
Last updated: 2026-08-19T10:27:05.636000+00:00

License: fr-lo
Update frequency: monthly
Spatial granularity: fr:commune
Spatial zones: country:fr
```

## structuredContent (keys)

- `dataset`

## Assertions

- [x] `tools/list` includes `get_dataset_info`
- [x] Tool returned without `isError`
- [x] Text content present (1408 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_dataset_info` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
