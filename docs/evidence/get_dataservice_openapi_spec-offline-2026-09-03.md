# Evidence: get_dataservice_openapi_spec (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 15 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "dataservice_id": "672cf67802ef6b1be63b8975"
}
```

## Output (text, truncated)
```text
OpenAPI spec for: API Adresse (Base Adresse Nationale - BAN)
Source: https://data.geopf.fr/geocodage/openapi.yaml
Base API URL: https://data.geopf.fr/geocodage/

API: API Géoplateforme - Géocodage
Version: 1.0.0
Description: Ce service permet d'obtenir des coordonnées à partir d'une adresse ou d'un nom de lieu / point d'intérêt ou d'une parcelle (ou l'inverse...).

Servers:
  - https://data.geopf.fr/geocodage

Endpoints (2 operations):
  GET /getCapabilities
    Découvrir le service
  GET /search
    Recherche par géocodage direct
      - q [query, string]
      - autocomplete [query, string]
      - index [query, ]
      - limit [query, integer]
      - lat [query, number]
      - lon [query, number]
      - returntruegeometry [query, boolean]
      - postcode [query, ]
      - citycode [query, ]
      - depcode [query, ]
      - type [query, string]
      - city [query, string]
      - category [query, ]
      - departmentcode [query, string]
      - municipalitycode [query, string]
      - oldmunicipalitycode [query, string]
      - districtcode [query, string]
      - section [query, string]
      - number [query, string]
      - sheet [query, string]
```

## structuredContent (keys)
- `dataservice_id`
- `title`
- `source_url`
- `base_api_url`
- `has_spec`
- `api`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1173 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
