# Evidence: suggest (live stdio)

**Date**: 2026-09-03T16:55:45.198Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 906 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "suggest",
  "arguments": {
    "query": "popu",
    "size": 5
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `suggest` present

## Output (text, truncated to 80 lines)

```text
Suggestions for 'popu':
  - [dataset] Population (id: 53699d0ea3a729239d205b2e) https://www.data.gouv.fr/datasets/population
  - [dataset] Anciennes données carroyées à 200 m sur la population (id: 5369931ca3a729239d2040d1) https://www.data.gouv.fr/datasets/anciennes-donnees-carroyees-a-200-m-sur-la-population
  - [dataset] Bases de données et fichiers détails du recensement de la population (id: 548ad919c751df3d674120e7) https://www.data.gouv.fr/datasets/bases-de-donnees-et-fichiers-details-du-recensement-de-la-population
  - [dataset] Recensement de la population - Fichiers détail : Logements ordinaires (id: 653668616ffc5fc0becb52b4) https://www.data.gouv.fr/datasets/recensement-de-la-population-fichiers-detail-logements-ordinaires
  - [dataset] Recensement de la population - Fichiers détail : Individus localisés au canton-ou-ville  (id: 6536661882301752417a278d) https://www.data.gouv.fr/datasets/recensement-de-la-population-fichiers-detail-individus-localises-au-canton-ou-ville
  - [organization] Institut national de la jeunesse et de l’éducation populaire (id: 5a09abfc88ee3842e9e22010) https://www.data.gouv.fr/organizations/institut-national-de-la-jeunesse-et-de-leducation-populaire
  - [organization] Centre d'Epidémiologie et de Recherche en sante des Populations  UMR1295 (CERPOP) ; Institut Universitaire du Cancer de Toulouse - Oncopole (IUCT-O), Groupe de recherche et d'analyse en santé des populations (GAP)  (id: 6155661a39fcf38140fe4850) https://www.data.gouv.fr/organizations/centre-depidemiologie-et-de-recherche-en-sante-des-populations-umr1295-cerpop-institut-universitaire-du-cancer-de-toulouse-oncopole-iuct-o-groupe-de-recherche-et-danalyse-en-sante-des-populations-gap
  - [organization] Secours populaire La Rochelle (id: 5631440f88ee3848d4531575) https://www.data.gouv.fr/organizations/secours-populaire-la-rochelle
  - [organization] BANQUE POPULAIRE VAL DE FRANCE (id: 67166a0147ac22284713cb1e) https://www.data.gouv.fr/organizations/banque-populaire-val-de-france
  - [organization] BANQUE POPULAIRE MÉDITERRANÉE (id: 66fa70be1955b4bc4b7c5f36) https://www.data.gouv.fr/organizations/banque-populaire-mediterranee
  - [tag] population (id: population)
  - [tag] populations-exposees (id: populations-exposees)
  - [tag] repartition-de-la-population (id: repartition-de-la-population)
  - [tag] demographie-et-population-recensement (id: demographie-et-population-recensement)
  - [tag] repartition-de-la-population-demographie (id: repartition-de-la-population-demographie)
  - [zone] Saint-Lumier-la-Populeuse (fr:commune) (id: fr:commune:51497)
```

## structuredContent (keys)

- `query`
- `kind`
- `suggestions`

## Assertions

- [x] `tools/list` includes `suggest`
- [x] Tool returned without `isError`
- [x] Text content present (2591 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `suggest` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
