# Evidence: suggest (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "query": "popu",
  "size": 5
}
```

## Output (text, truncated)
```text
Suggestions for 'popu':
  - [dataset] Population (id: 53699d0ea3a729239d205b2e) https://www.data.gouv.fr/datasets/population
  - [dataset] Anciennes données carroyées à 200 m sur la population (id: 5369931ca3a729239d2040d1) https://www.data.gouv.fr/datasets/anciennes-donnees-carroyees-a-200-m-sur-la-population
  - [dataset] Bases de données et fichiers détails du recensement de la population (id: 548ad919c751df3d674120e7) https://www.data.gouv.fr/datasets/bases-de-donnees-et-fichiers-details-du-recensement-de-la-population
  - [dataset] Recensement de la population - Fichiers détail : Logements ordinaires (id: 653668616ffc5fc0becb52b4) https://www.data.gouv.fr/datasets/recensement-de-la-population-fichiers-detail-logements-ordinaires
  - [dataset] Recensement de la population - Fichiers détail : Individus localisés au canton-ou-ville  (id: 6536661882301752417a278d) https://www.data.gouv.fr/datasets/recensement-de-la-population-fichiers-detail-individus-localises-au-canton-ou-ville
  - [organization] Institut national de la statistique et des études économiques (Insee) (id: 534fff81a3a7292c64a77e5c) https://www.data.gouv.fr/organizations/institut-national-de-la-statistique-et-des-etudes-economiques-insee
  - [organization] FINSEEK (id: 696decfad86466dcba0e150e) https://www.data.gouv.fr/organizations/finseek
  - [organization] INSEEC Insight Seekers (id: 664b0cf37501e5ba115edb77) https://www.data.gouv.fr/organizations/inseec-insight-seekers
  - [organization] INSEEC_Équipe_3_ODU (id: 66452802001bf357ae0ea0a9) https://www.data.gouv.fr/organizations/inseec-equipe-3-odu
  - [organization] Inseec_ODU_Equipe4 (id: 6643a68af3847c75750300e8) https://www.data.gouv.fr/organizations/inseec-odu-equipe4
  - [tag] transport (id: transport)
  - [tag] transports (id: transports)
  - [tag] transportation (id: transportation)
  - [tag] transport-en-commun (id: transport-en-commun)
  - [tag] reseaux-de-transport (id: reseaux-de-transport)
  - [zone] Paris (fr:departement) (id: fr:departement:75)
  - [zone] Le Grand Paris (fr:epci) (id: fr:epci:200054781)
  - [zone] Grand Paris Seine et Oise (fr:epci) (id: fr:epci:200059889)
  - [zone] Communauté Paris-Saclay (fr:epci) (id: fr:epci:200056232)
  - [zone] Grand Paris Sud Seine Essonne Sénart (fr:epci) (id: fr:epci:200059228)
```

## structuredContent (keys)
- `query`
- `kind`
- `suggestions`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (2292 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
