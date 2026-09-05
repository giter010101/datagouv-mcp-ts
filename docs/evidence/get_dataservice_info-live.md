# Evidence: get_dataservice_info (live stdio)

**Date**: 2026-09-03T16:59:24.017Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 191 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_dataservice_info",
  "arguments": {
    "dataservice_id": "672cf67802ef6b1be63b8975"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `get_dataservice_info` present

## Output (text, truncated to 80 lines)

```text
Third-party API information: API Adresse (Base Adresse Nationale - BAN)

ID: 672cf67802ef6b1be63b8975
URL: https://www.data.gouv.fr/dataservices/api-adresse-base-adresse-nationale-ban

Description: L' API Adresse permet d'interroger facilement la Base Adresse Nationale.

### A quoi sert l'API Adresse ?

En intégrant l'API dans votre système d'information, vous pouvez facilement rechercher une adresse et :

- faire de l'autocomplétion et de la vérification d'adresse ;
- géolocaliser une adresse sur une carte ;
- faire une recherche géographique inversée (trouver la rue la plus proche de coordonnées géographiques).

### Données disponibles

| Nom              | Description                ...

Base API URL: https://data.geopf.fr/geocodage/
OpenAPI/Swagger spec: https://data.geopf.fr/geocodage/openapi.yaml
Documentation: https://adresse.data.gouv.fr/outils/api-doc/adresse
Access type: open
Availability: 100%

Organization: Institut national de l'information géographique et forestière
  Organization ID: 534fff80a3a7292c64a77e41

Tags: adresse, ban, base, carte, code-postal, geocodage, geographie, geospatiales, gps, hvd

Created: 2024-11-07T17:18:48.601000+00:00
Last updated: 2026-04-17T11:49:47.375000+00:00

Related datasets: 1
```

## structuredContent (keys)

- `dataservice`

## Assertions

- [x] `tools/list` includes `get_dataservice_info`
- [x] Tool returned without `isError`
- [x] Text content present (1242 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_dataservice_info` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
