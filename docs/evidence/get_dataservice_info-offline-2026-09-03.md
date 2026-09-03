# Evidence: get_dataservice_info (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataservice_id": "672cf67802ef6b1be63b8975"
}
```

## Output (text, truncated)
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

Tags: adresse, ban, base

Created: 2024-11-07T17:18:48.601000+00:00
Last updated: 2026-04-17T11:49:47.375000+00:00

Related datasets: 1
```

## structuredContent (keys)
- `dataservice`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1175 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
