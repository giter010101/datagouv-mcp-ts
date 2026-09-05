# Evidence: list_high_value_datasets (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 1 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "page_size": 3
}
```

## Output (text, truncated)
```text
Found 718 high value dataset(s) for: 'HVD'
Page 1 of results:

1. Base Adresse Nationale
   ID: 5530fbacc751df5ff937dddb
   Description: La Base Adresse Nationale est l’une des neuf bases de données du service public des données de référence. C'est le référentiel d'adresses officiellement reconnu par l’administration. Service numéri...
   Organization: Base Adresse Nationale
   Tags: adresse, adresses, ban
   Resources: 4
   URL: https://www.data.gouv.fr/datasets/base-adresse-nationale/

2. Résultats du contrôle sanitaire de l'eau distribuée commune par commune
   ID: 5cf8d9ed8b4c4110294c841d
   Description: ! ATTENTION ! : L'anomalie identifiée a été corrigée. La diffusion des données a repris. Un rattrapage des données passées a été réalisé jusqu'en 2024 inclus. Résultats du contrôle sanitaire de l'e...
   Organization: Ministère des Solidarités et de la Santé
   Tags: alimentation-en-eau, controle-sanitaire, distribution-d-eau
   Resources: 23
   URL: https://www.data.gouv.fr/datasets/resultats-du-controle-sanitaire-de-leau-distribuee-commune-par-commune/

3. Revenus et pauvreté des ménages aux niveaux national et local - Revenus localisés sociaux et fiscaux
   ID: 5b156279c751df40bb588de9
   Description: L'objectif du dispositif FiLoSoFi est de produire un ensemble d’indicateurs sur les revenus déclarés (avant redistribution) d’une part, et sur les revenus disponibles (après redistribution et imput...
   Organization: Institut national de la statistique et des études économiques (Insee)
   Tags: distribution-des-revenus, hvd, pauvrete
   Resources: 4
   URL: https://www.data.gouv.fr/datasets/revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-revenus-localises-sociaux-et-fiscaux/

More results available: use page=2.
```

## structuredContent (keys)
- `query`
- `category`
- `total`
- `page`
- `page_size`
- `has_next`
- `datasets`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1759 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
