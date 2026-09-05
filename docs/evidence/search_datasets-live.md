# Evidence: search_datasets (live stdio)

**Timestamp**: 2026-09-03T16:08:01.190Z  
**Agent**: Composer (harmonization)  
**Status**: **PASS**  
**Transport**: stdio (`node dist/index.js`)  
**Duration**: 5016 ms  
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "search_datasets",
  "arguments": {
    "query": "population",
    "page_size": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-search.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `search_datasets` present

## Output (text, truncated to 80 lines)

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

- [x] `tools/list` includes `search_datasets` (21 tools total)
- [x] Tool returned without `isError`
- [x] Text content present (1727 chars, 27 lines)
- [x] `structuredContent` present with expected keys
- [x] Results mention "population" and include Insee datasets

## Verdict

**PASS** — live stdio call to `search_datasets` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-search.mjs
# or:
pnpm evidence --tool search_datasets --input '{"query":"population","page_size":3}' --stdio
```
