# Evidence: search_dataservices (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 8 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "query": "adresse",
  "page_size": 3
}
```

## Output (text, truncated)
```text
Found 316 third-party API(s) for query: 'adresse'
Page 1 of results:

1. API Adresse (Base Adresse Nationale - BAN)
   ID: 672cf67802ef6b1be63b8975
   Description: L' API Adresse permet d'interroger facilement la Base Adresse Nationale.

### A quoi sert l'API Adresse ?

En intégrant l'API dans votre système d'information, vous pouvez facilement rechercher une...
   Organization: Institut national de l'information géographique et forestière
   Base API URL: https://data.geopf.fr/geocodage/
   Tags: adresse, ban, base
   URL: https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban

2. API Fichier des Comptes Bancaires et Assimilés (FICOBA)
   ID: 672dcfd4fb13e93799d97e68
   Description: L'API FICOBA (*FI*chier des *CO*mptes *B*ancaires et *A*ssimilés) permet aux entités administratives (administrations publiques, ministères, organismes sociaux) et aux acteurs privés qui sont éligi...
   Organization: Ministères économiques et financiers
   Tags: bancaire, banque, civil
   URL: https://www.data.gouv.fr/dataservices/api-fichier-des-comptes-bancaires-et-assimiles-ficoba

3. API Recherche des personnes physiques (R2P)
   ID: 672cf67aa37a79f6ff3e324e
   Description: ### ATTENTION :&#x20;

**A partir du 30/09/2025, l'API SFiP reprend les fonctionnalités de recherche de personne physique de l'API R2P.** \
\
**Dorénavant, les nouvelles demandes concernant l'API R...
   Organization: Ministères économiques et financiers
   Tags: adresse, civil, etat
   URL: https://www.data.gouv.fr/dataservices/api-recherche-des-personnes-physiques-r2p

More results available: use page=2.
```

## structuredContent (keys)
- `query`
- `effective_query`
- `total`
- `page`
- `page_size`
- `has_next`
- `dataservices`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1608 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
