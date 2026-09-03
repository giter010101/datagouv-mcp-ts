# Evidence: list_topics (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "query": "transport",
  "page_size": 3
}
```

## Output (text, truncated)
```text
Found 26 topic(s) for query: 'transport'
Page 1 of results:

1. 🚎 Tarification sociale/solidaire des transports publics | Attribution
   ID: 68da7823bc643f6ea5cae5a0
   Description: Autorités organisatrices de mobilité (AOM), récupérez à la source les informations nécessaires pour déterminer l'éligibilité de vos usagers et leur attribuer automatiquement le tarif adapté pour le...
   Tags: simplifions-v2, simplifions-v2-dag-generated, simplifions-v2-cas-d-usages
   URL: https://www.data.gouv.fr/topics/tarification-sociale-solidaire-des-transports-publics-attribution/

2. Indicateurs du tableau de bord des mobilités durables
   ID: 6811e889b455bf5bbde45517
   Description: #### Présentation
Le tableau de bord des mobilités durables est un outil national au service des territoires qui a pour objectif de faciliter l’orientation, la prise de décision et le suivi en mati...
   Tags: ecospheres, univers-ecospheres, ecospheres-theme-se-deplacer
   URL: https://www.data.gouv.fr/topics/indicateurs-du-tableau-de-bord-des-mobilites-durables/

3. Les données relatives à l'énergie
   ID: 64d247b84ab64f73c5dd9cd4
   Description: Cette page a pour vocation de référencer les principaux jeux de données relatifs à la thématique “énergie” disponibles sur data.gouv.fr. Celle-ci n’est pas exhaustive et est ouverte aux contributio...
   Tags: carburant, gaz, energie
   URL: https://www.data.gouv.fr/topics/les-donnees-relatives-a-lenergie/

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
- [x] Tool returned without `isError`
- [x] Text content present (1476 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
