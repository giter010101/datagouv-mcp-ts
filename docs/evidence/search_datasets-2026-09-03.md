# Evidence: search_datasets

**Date**: 2026-09-03
**Agent**: architect
**Status**: PASS
**Transport**: stdio (dist/index.js)
**Duration**: 732 ms
**Data env**: prod

## Input
```json
{
  "query": "population",
  "page_size": 3
}
```

## Output (text, truncated to 60 lines)
```text
Found 2710 dataset(s) for query: 'population'
Page 1 of results:

1. Population
   ID: 53699d0ea3a729239d205b2e
   Description: Ce jeu de données permet d'accéder aux résultats des recensements de la population, à des séries chronologiques de la Banque de Données Macro-économiques de l'Insee sur le thème de la population et...
   Organization: Institut national de la statistique et des études économiques (Insee)
   Tags: deces, demographie, etat-civil, famille, mariages
   Resources: 8
   URL: https://www.data.gouv.fr/datasets/population/

2. Anciennes données carroyées à 200 m sur la population
   ID: 5369931ca3a729239d2040d1
   Description: Cette page n’est plus maintenue, vous pouvez consulter les données plus récentes sur la page Revenus, pauvreté et niveau de vie - Données carroyées issues du Dispositif Fichier localisé social et f...
   Organization: Institut national de la statistique et des études économiques (Insee)
   Resources: 3
   URL: https://www.data.gouv.fr/datasets/anciennes-donnees-carroyees-a-200-m-sur-la-population/

3. Données sur la localisation et l’accès de la population aux équipements
   ID: 67fe0fe2423db9c4a05d8ced
   Description: Ce jeu de données produit par l’Insee permet de s’intéresser aux temps d’accès aux équipements, en utilisant comme source principale la base permanente des équipements (BPE). Il fournit, pour chaqu...
   Organization: Institut national de la statistique et des études économiques (Insee)
   Tags: acces-aux-equipements, bpe, distance-aux-equipements, insee, services-aux-particuliers
   Resources: 33
   URL: https://www.data.gouv.fr/datasets/donnees-sur-la-localisation-et-lacces-de-la-population-aux-equipements/

More results available: use page=2.
```

## structuredContent (keys)
- `query`
- `effective_query`
- `total`
- `page`
- `page_size`
- `has_next`
- `datasets`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1727 chars)
- [x] `structuredContent` present
- [x] Text under 50 KB

## Full output
See `docs/evidence/raw/search_datasets-2026-09-03.json` (git-ignored; regenerate with the command below).

```bash
pnpm evidence --tool search_datasets --input '{"query":"population","page_size":3}' --stdio
```
