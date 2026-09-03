# Evidence: get_dataservice_openapi_spec (live stdio)

**Date**: 2026-09-03T16:59:24.210Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 1551 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_dataservice_openapi_spec",
  "arguments": {
    "dataservice_id": "672cf67802ef6b1be63b8975"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `get_dataservice_openapi_spec` present

## Output (text, truncated to 80 lines)

```text
OpenAPI spec for: API Adresse (Base Adresse Nationale - BAN)
Source: https://data.geopf.fr/geocodage/openapi.yaml
Base API URL: https://data.geopf.fr/geocodage/

API: API Géoplateforme - Géocodage
Version: 1.0.0
Description: Ce service permet d'obtenir des coordonnées à partir d'une adresse ou d'un nom de lieu / point d'intérêt ou d'une parcelle (ou l'inverse...).

Servers:
  - https://data.geopf.fr/geocodage

Endpoints (15 operations):
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
  GET /reverse
    Recherche par géocodage inverse
      - searchgeom [query, string]
      - lon [query, number]
      - lat [query, number]
      - index [query, ]
      - limit [query, integer]
      - returntruegeometry [query, boolean]
      - postcode [query, ]
      - citycode [query, ]
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
  POST /search/csv
    Géocodage direct en masse d’un fichier CSV
  POST /reverse/csv
    Géocodage inversé en masse d’un fichier CSV
  POST /async/projects
    Créer un nouveau projet
      - X-Community [header, string]
  GET /async/projects/{projectId}
    Récupérer les informations
      - projectId [path, string] (required)
  DELETE /async/projects/{projectId}
    Supprimer un projet
      - projectId [path, string] (required)
  PUT /async/projects/{projectId}/pipeline
    Définir les paramètres du traitement
      - projectId [path, string] (required)
  PUT /async/projects/{projectId}/input-file
    Uploader un fichier d'entrée pour un projet
      - projectId [path, string] (required)
      - Content-Length [header, integer]
      - Content-Disposition [header, string]
  POST /async/projects/{projectId}/start
    Démander le démarrage du géocodage
      - projectId [path, string] (required)
… (14 more lines)
```

## structuredContent (keys)

- `dataservice_id`
- `title`
- `source_url`
- `base_api_url`
- `has_spec`
- `api`

## Assertions

- [x] `tools/list` includes `get_dataservice_openapi_spec`
- [x] Tool returned without `isError`
- [x] Text content present (3354 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_dataservice_openapi_spec` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
