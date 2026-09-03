# Evidence: search_dataservices (live stdio)

**Date**: 2026-09-03T16:59:23.049Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 968 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "search_dataservices",
  "arguments": {
    "query": "adresse",
    "page_size": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `search_dataservices` present

## Output (text, truncated to 80 lines)

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
   Tags: adresse, ban, base, carte, code-postal
   URL: https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban

2. API Fichier des Comptes Bancaires et Assimilés (FICOBA)
   ID: 672dcfd4fb13e93799d97e68
   Description: L'API FICOBA (*FI*chier des *CO*mptes *B*ancaires et *A*ssimilés) permet aux entités administratives (administrations publiques, ministères, organismes sociaux) et aux acteurs privés qui sont éligi...
   Organization: Ministères économiques et financiers
   Tags: bancaire, banque, civil, compte, entreprise
   URL: https://www.data.gouv.fr/dataservices/api-fichier-des-comptes-bancaires-et-assimiles-ficoba

3. API Recherche des personnes physiques (R2P)
   ID: 672cf67aa37a79f6ff3e324e
   Description: ### ATTENTION :&#x20;

**A partir du 30/09/2025, l'API SFiP reprend les fonctionnalités de recherche de personne physique de l'API R2P.** \
\
**Dorénavant, les nouvelles demandes concernant l'API R...
   Organization: Ministères économiques et financiers
   Tags: adresse, civil, etat, fiscal, identifiant
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

- [x] `tools/list` includes `search_dataservices`
- [x] Tool returned without `isError`
- [x] Text content present (1669 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `search_dataservices` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
