# Resource Formats Catalog (data.gouv.fr)

**Research date:** 2026-09-03  
**Primary data source:** Catalog export `export-resource-20260903-060151.csv` from dataset `5d13a8b6634f41070a43dff3` (688,376 resources)  
**Secondary source:** udata API `format` filter on datasets (counts datasets, not resources)  
**User-Agent:** `datagouv-mcp-research/0.1`

---

## 1. Format distribution (resource-level)

### 1.1 Top 20 formats (by resource count)

| Rank | Format | Resources | % of catalog |
|------|--------|-----------|--------------|
| 1 | `csv` | 99,175 | 14.4% |
| 2 | *(empty)* | 74,460 | 10.8% |
| 3 | `json` | 68,820 | 10.0% |
| 4 | `zip` | 55,584 | 8.1% |
| 5 | `pdf` | 49,586 | 7.2% |
| 6 | `wms` | 44,210 | 6.4% |
| 7 | `wfs` | 41,461 | 6.0% |
| 8 | `shp` / `esri shapefile` | ~34,154 + 29,383 | ~9.2% combined |
| 9 | `geojson` | 14,845 | 2.2% |
| 10 | `html` / `web page` | ~12,519 + 7,921 | ~3.0% |
| 11 | `xml` | 11,211 | 1.6% |
| 12 | `mapinfo tab` | 10,956 | 1.6% |
| 13 | `kml` | 7,894 | 1.1% |
| 14 | `xlsx` | 6,297 | 0.9% |
| 15 | `xls` | 5,919 | 0.9% |
| 16 | `csv.gz` | 5,101 | 0.7% |
| 17 | `arcgis geoservices rest api` | 4,608 | 0.7% |
| 18 | `grib2` | 3,719 | 0.5% |
| 19 | `txt` | 3,022 | 0.4% |
| 20 | `ods` | 2,580 | 0.4% |

**Total resources in export:** 688,376  
**Total datasets (site metrics):** 74,200

### 1.2 Requested formats table

| Format | Resources | Typical MIME types | Tabular API | Recommended MCP access strategy | Example resource |
|--------|-----------|------------------|-------------|--------------------------------|------------------|
| **csv** | 99,175 | `text/csv`, `application/csv`, often `application/javascript` on broken remotes | ✅ if `parsing_table` (~59% of CSVs) | 1) Tabular API filter/sort 2) Parquet if available 3) stream parse with `csv-parse` / `PapaParse` (sample 1k rows) | Tabular: `a86ebc34-a979-4d6c-8f2a-9710a43dca93`; non-tabular: `dbab1fa5-b902-4586-81e0-6063a6f96ca9` |
| **csv.gz** | 5,101 | `text/csv`, `application/gzip`, `application/x-gzip` | ✅ if parsed (subset) | Gunzip (`zlib`/`fflate`) then same as CSV; check size before full download | `4d344bb5-abfb-4cb5-a9aa-4b7f26c00466` |
| **tsv** | 4 | `text/tab-separated-values`, `text/plain` | Rare | `csv-parse` with `delimiter:'\t'`; stream only | — |
| **xls** | 5,919 | `application/vnd.ms-excel`, `application/xls` | Sometimes (legacy) | Tabular API if profile 200; else `xlsx`/`SheetJS` with `cellDates:true`; limit sheets | `34826ee2-d940-4697-937b-21c1977bda77` |
| **xlsx** | 6,297 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ✅ if parsed (~subset) | Tabular API first (≤12.5 MB unless exception); else `exceljs`/`xlsx` read-only | `45f3844f-0039-48ec-ade7-7dc8c429168b` |
| **ods** | 2,580 | `application/vnd.oasis.opendocument.spreadsheet` | Rare | `xlsx` lib limited; use `sheetjs` ODS mode or convert server-side; metadata-only if huge | `338fefaa-3b9d-4ae4-b8cf-a2af363cecbf` |
| **json** | 68,820 | `application/json`, `application/geo+json`, `application/ld+json` | ❌ | `JSON.parse` stream via `stream-json` for large files; schema infer from first N records | `a39eb5fa-65ac-40bf-b639-b18b7ba03f5d` |
| **jsonl / ndjson** | 7 | `application/x-ndjson`, `text/plain` | ❌ | Line-by-line `readline` + `JSON.parse`; sample 500 lines | — |
| **geojson** | 14,845 | `application/geo+json`, `application/json` | ❌ (but GeoJSON conversion exists) | `geojson` npm; check `analysis:parsing:geojson_url`; map preview via `pmtiles_url` | `7c257c68-14ec-495e-9823-99d30ccab111` |
| **topojson** | 0 | `application/json` | ❌ | `topojson-client` to decode; rare on platform | — |
| **shp (zip)** | ~63,500 | `application/zip`, `application/x-esri-shape`, empty | ❌ | **Metadata + download link**; in-process parsing impractical — suggest `shpjs` only for small zips (<10 MB) | `8ea6f0fa-1d90-4afd-ad7b-739f4c4c6860` |
| **gpkg** | 984 | `application/geopackage+sqlite3` | ❌ | `better-sqlite3` + SQL or `@ngageoint/geopackage`; heavy — metadata + bbox only in MCP | `7a204f4f-dda4-4d68-8bbe-697ed2df19e1` |
| **kml / kmz** | 7,894 / 502 | `application/vnd.google-earth.kml+xml`, `application/vnd.google-earth.kmz` | ❌ | `@tmcw/togeojson` → GeoJSON; KMZ = unzip first | `9f8121be-4f21-4c79-a6a7-5dd33f09b57d` |
| **gml** | 23 | `application/gml+xml`, `text/xml` | ❌ | XML parser; convert with `ogr2ogr` externally; metadata-only in MCP | — |
| **parquet** | 871 | `application/parquet`, `application/octet-stream` | ❌ (but Hydra produces parquet for CSVs) | `@dsnp/parquetjs` or `apache-arrow`; prefer `analysis:parsing:parquet_url` when present | `a7c9b00f-4014-4ad3-ad7f-c7432c24db4c` |
| **xml** | 11,211 | `text/xml`, `application/xml`, GML variants | ❌ | `fast-xml-parser`; XPath for records; rarely queryable | `83b52ca5-9c18-4807-a7c8-05a7ab6c4b61` |
| **rdf / ttl / n3** | 25 / 122 / 279 | `text/turtle`, `application/n-triples`, `application/rdf+xml` | ❌ | Metadata + link; `n3`/`rdf-parse` for small files only | `f7531c47-64b5-42f7-941d-cfb758aea9cf` (ttl) |
| **pdf** | 49,586 | `application/pdf` | ❌ | **Metadata-only** or `pdf-parse` for text extraction (first pages); no tabular query | `08f143f0-e125-45b1-a727-83b6576cef60` |
| **zip** | 55,584 | `application/zip` | ❌ | Inspect listing with `yauzl`/`unzipper`; do not auto-extract large archives | `c0f7bd6d-99b6-4a6f-b17d-52767cfcd3b7` |
| **7z** | 666 | `application/x-7z-compressed` | ❌ | Metadata-only (no native TS lib) | — |
| **tar.gz** | 26 | `application/gzip`, `application/x-tar` | ❌ | `tar-stream` + gunzip for small archives | — |
| **html** | ~20,440 | `text/html`, `application/javascript` (misdetected remotes) | ❌ | **Metadata-only**; `cheerio` for table scrape only when `check:available` and small | `43c98360-90da-4920-b0d3-52f34d0b9d42` |
| **api / url** | 57 + 1,848 `url` | `text/html`, empty | ❌ | Treat as **remote dataservice**; return URL + `check:*` status; never fetch blindly | `15d95744-879d-4c3f-a00a-14be05a72b35` |
| **wms / wfs / OGC** | 44,210 / 41,461 (+ `ogc:wms` 2,320) | Often empty; `application/vnd.ogc.wms_xml` | ❌ | **Metadata-only**; return GetCapabilities URL; optional link to API Carto dataservice | `202c55f0-6be6-4880-8055-9c6a03892857` (wms) |
| **sqlite** | 0 | — | ❌ | N/A on platform | — |
| **mdb** | 0 | — | ❌ | N/A | — |
| **dbf** | 367 | `application/dbf`, `application/x-dbf` | ❌ | `dbffile` npm for small files; usually inside shapefile zips | — |
| **txt** | 3,022 | `text/plain` | ❌ | Read as text; attempt CSV/TSV detection | `bbaca630-1312-469b-a8d5-a326411c2405` |
| **md** | 5 | `text/markdown` | ❌ | Return raw text (documentation) | — |
| **ics** | 57 | `text/calendar` | ❌ | `node-ical` for parse; niche | — |
| **png / jpg** | 338 / 2,309 | `image/png`, `image/jpeg` | ❌ | **Metadata-only** (return URL, dimensions if HEAD available) | `3d5c1ff0-f8e0-4ebb-93b6-357d5ba791a5` |
| **docx / odt** | 439 / 176 | OOXML / ODF | ❌ | `mammoth` (docx text), `officeparser`; documentation use case | — |
| **documentation** | type=`documentation` (3,844 resources) | varies | ❌ | Metadata + download; type-driven, not format-driven | `512d27b7-6cef-40bb-a7fa-3f0d272ca2d1` (`format: document`) |
| **remote (external)** | 547,052 (`filetype=remote`) | any | Per parsing extras | Always check `check:available`, `check:status`, `check:error` before fetch | `4792c248-8b80-4524-8605-7d4213e49051` (INSEE HTML, `check:status:400`) |

### 1.3 Tabular API coverage summary

| Metric | Value |
|--------|-------|
| Resources with `analysis:parsing:parsing_table` | **58,720** (8.5% of all resources) |
| CSV resources total | 99,175 |
| CSV → tabular conversion rate | **~59.2%** |
| XLSX resources total | 6,297 |
| Crawler size exceptions | 2,287 resource IDs |
| Tabular API max `page_size` | **200** |
| Default CSV size limit | 100 MB (exceptions apply) |
| Default XLSX size limit | 12.5 MB (exceptions apply) |

---

## 2. Resource `type` and `filetype` enums

### 2.1 `type` (resource role)

From `GET /api/1/datasets/resource_types/`:

| `type` | Label (FR) | Count in catalog | MCP treatment |
|--------|------------|------------------|---------------|
| `main` | Fichier principal | 494,647 | Primary data access target |
| `api` | API | 87,577 | Link / dataservice proxy; often `filetype=remote` |
| `other` | Autre | 90,899 | Infer from format |
| `documentation` | Documentation | 3,844 | Metadata + optional text extract |
| `update` | Mise à jour | 11,347 | Changelog / patch files |
| `code` | Dépôt de code | 62 | Git URL or archive |

### 2.2 `filetype`

| `filetype` | Count | Meaning |
|------------|-------|---------|
| `remote` | 547,052 | URL points to external host; no `static.data.gouv.fr` copy |
| `file` | 141,324 | Hosted on `static.data.gouv.fr` |

**Quirk:** 79.5% of resources are `remote` — MCP must handle link rot (`check:available: false` on 26,560 resources where `check:available` is explicitly false in extras sample).

---

## 3. Resource `extras` keys (observed in catalog)

Keys with occurrence counts from 688,376 resources (JSON-parseable extras):

### 3.1 Check / availability (Hydra link checker)

| Key | Count | Example value |
|-----|-------|---------------|
| `check:available` | 470,048 | `true` / `false` |
| `check:status` | 403,292 | `200`, `400`, `403`, `404` |
| `check:date` | 473,488 | `2026-09-02T21:46:30.217618+00:00` |
| `check:timeout` | 419,790 | `false` |
| `check:id` | 270,825 | `52710616` |
| `check:url` | 91,521 | actual checked URL |
| `check:error` | 61,078 | `"Bad Request"`, `"Erreur Interne de Servlet"` |
| `check:count-availability` | 92,226 | consecutive check count |
| `check:headers:content-type` | 445,008 | `text/csv` |
| `check:headers:content-length` | 257,794 | byte size |
| `check:headers:charset` | 57,777 | `utf-8` |
| `check:headers:content-disposition` | 41,026 | filename hints |
| `check:cors:status` | 226,703 | `200`, `204` |
| `check:cors:allow-origin` | 203,637 | `*` |
| `check:cors:allow-methods` | 199,489 | `GET, OPTIONS` |
| `check:cors:allow-headers` | 202,277 | long header list |
| `check:cors:max-age` | 156,227 | `1728000` |
| `check:cors:allow-credentials` | 135,692 | `true` |
| `check:cors:expose-headers` | 47,557 | may include `X-RateLimit-*` |

### 3.2 Analysis (Hydra file analyzer)

| Key | Count | Example |
|-----|-------|---------|
| `analysis:checksum` | 354,499 | SHA1 hex |
| `analysis:content-length` | 354,499 | bytes |
| `analysis:mime-type` | 354,499 | detected MIME (may differ from `resource.mime`) |
| `analysis:last-modified-at` | 307,128 | ISO datetime |
| `analysis:last-modified-detection` | 307,128 | `content-length-header`, `last-modified-header` |
| `analysis:check_id` | 148,171 | links to check run |
| `analysis:error` | 9,907 | `"File too large to download"` |

### 3.3 Parsing (Tabular / conversions)

| Key | Count | Example |
|-----|-------|---------|
| `analysis:parsing:started_at` | 78,290 | ISO datetime |
| `analysis:parsing:finished_at` | 96,699 | ISO datetime |
| `analysis:parsing:parsing_table` | 58,720 | `e3686d542d96b3b5c75d40b27b566707` |
| `analysis:parsing:parquet_url` | 19,820 | `https://hydra.s3.rbx.io.cloud.ovh.net/parquet/{rid}.parquet` |
| `analysis:parsing:parquet_size` | 19,820 | `722001` |
| `analysis:parsing:geojson_url` | 10,818 | GeoJSON conversion |
| `analysis:parsing:geojson_size` | 10,818 | bytes |
| `analysis:parsing:pmtiles_url` | 17,697 | PMTiles for explore maps |
| `analysis:parsing:pmtiles_size` | 17,697 | bytes |
| `analysis:parsing:error` | 14,025 | e.g. pmtiles conversion failure |
| `analysis:parsing:ogc_metadata` | 10,276 | `{"format":"wms","version":"1.3.0",...}` |

### 3.4 Validation (Validata / schema.data.gouv.fr)

| Key | Count | Example |
|-----|-------|---------|
| `validation-report:schema_name` | 8,769 | `etalab/schema-irve-statique` |
| `validation-report:schema_version` | 8,769 | `2.3.1` |
| `validation-report:schema_type` | 8,769 | `tableschema` |
| `validation-report:validator` | 8,769 | `validata` |
| `validation-report:valid_resource` | 8,769 | `true` |
| `validation-report:nb_errors` | 8,769 | `0` |
| `validation-report:validation_date` | 8,769 | ISO datetime |
| `validation-report:errors` | 8,768 | `[]` |

### 3.5 Other extras

| Key | Count | Purpose |
|-----|-------|---------|
| `dcat` | 176,539 | DCAT rights / INSPIRE access constraints |
| `geop:resource_id` | 21,379 | GeoNetwork / geoportal id |
| `publish_source` | 4,254 | e.g. `publier.etalab.studio:table` |
| `datafairEmbed` | 1,793 | `map` embed hint |
| `consolidation_schema:update_schema` | 1,268 | schema consolidation |
| `consolidation_schema:add_schema` | 352 | schema consolidation |
| `apidocUrl` | 148 | external API doc |
| `dido_sync_rid` / `dido_sync_datetime` | 471 | DiDo sync metadata |

---

## 4. Other resource metadata fields

| Field | Notes |
|-------|-------|
| `schema` | `{name, version, url}` when resource declares a schema.data.gouv.fr schema |
| `checksum` | `{type: "sha1", value: "..."}` on hosted files |
| `filesize` | bytes (often null for `remote`) |
| `mime` | publisher-declared; frequently null or wrong on remotes |
| `last_modified` | ISO 8601; for remotes, from analysis |
| `url` | original URL |
| `latest` | `https://www.data.gouv.fr/api/1/datasets/r/{rid}` — stable redirect |
| `preview_url` | `https://explore.data.gouv.fr/fr/resources/{rid}` when Hydra parsed |
| `harvest` | `{uri, created_at, modified_at, issued_at, ...}` for harvested resources |
| `metrics` | `{views, downloads, ...}` on resource (v2) |

### 4.1 Quirks & failure modes

| Issue | Signal | Example |
|-------|--------|---------|
| Dead remote link | `check:available: false`, `check:status: 4xx` | `4792c248-8b80-4524-8605-7d4213e49051` (HTTP 400) |
| Wrong declared format | `format: csv,dbase` but `check:headers:content-type: text/html` | `d2a15598-9573-4082-bacd-7c73504e7839` |
| MIME mismatch | `mime: text/csv` but `analysis:mime-type: application/javascript` | Many INSEE remotes |
| Empty format | `format: ""` (74,460 resources) | Often WMS/WFS/remote |
| Huge file skipped | `analysis:error: File too large to download` | — |
| Parsing failed | no `parsing_table`, may have `analysis:parsing:error` | — |
| CSV not in Tabular API | no `parsing_table`, `/profile/` → 404 | `dbab1fa5-b902-4586-81e0-6063a6f96ca9` |

---

## 5. npm library recommendations by format

| Format | Library | Size limit (in-process) | Sampling strategy |
|--------|---------|-------------------------|-------------------|
| CSV/TSV | `csv-parse`, `PapaParse` | ≤50 MB or 500k rows | First 1k rows + headers; infer types |
| CSV.GZ | `zlib` + `csv-parse` | ≤50 MB decompressed | Stream gunzip |
| XLSX/XLS | `exceljs`, `xlsx` (SheetJS) | ≤12.5 MB (align with Hydra) | First sheet, first 1k rows |
| JSON | native / `stream-json` | ≤20 MB | First 100 records for schema |
| GeoJSON | `geojson` types | ≤10 MB | Features count + first 10 features bbox |
| Parquet | `apache-arrow`, `@dsnp/parquetjs` | stream footer only first | Row group sampling |
| Shapefile | `shpjs` | ≤10 MB zipped only | Bbox + field names |
| GPKG | `better-sqlite3` | metadata queries only | `gpkg_contents` table |
| KML/KMZ | `@tmcw/togeojson` | ≤5 MB | Convert to GeoJSON sample |
| PDF | `pdf-parse` | ≤5 MB | First 3 pages text |
| XML | `fast-xml-parser` | ≤10 MB | XPath count |
| ZIP | `yauzl` | list only ≤200 MB | List entries, don't extract |

---

## 6. Prioritized format tiers for TypeScript MCP

### Tier 1 — First-class (queryable, schema-inferred, filterable)

**Formats:** CSV, XLSX (and XLS when parsed), CSV.GZ when parsed

**Access path:**
1. `GET tabular-api .../profile/` → columns + types
2. `GET tabular-api .../data/?{col}__{op}=` → filtered rows
3. Fallback: `analysis:parsing:parquet_url` for analytics
4. Last resort: stream-parse with strict size caps

**~58,720 resources** (+ 2,287 size exceptions for edge cases).

### Tier 2 — Read-only preview (sample / summarize)

**Formats:** JSON, GeoJSON, Parquet (native), ODS, TXT (structured), JSONL, small ZIP (listing), KML, small DBF

**Behavior:** Return schema inference, row/feature count, sample rows, bbox for geo; no SQL-like filtering unless converted.

### Tier 3 — Metadata-only

**Formats:** PDF, HTML, images, WMS/WFS/OGC, RDF/TTL, DOCX/ODT, 7z/tar.gz, large SHP/GPKG/ZIP, remote URLs with failed checks, `type: documentation`

**Behavior:** Return title, description, URL, `check:*` status, `preview_url` if any; suggest Explore UI or external tools.

### Tier 4 — API / dataservice indirection

**Formats:** `type: api`, ArcGIS REST, dataservice records

**Behavior:** Link to `dataservice.machine_documentation_url`; optional OpenAPI fetch tool; do not treat as downloadable file.

---

## 7. Resource capability detection algorithm

```
INPUT: resource_id
FETCH: GET /api/2/datasets/resources/{rid}/

1. DELETED / MISSING?
   → ERROR "not found"

2. check:available == false OR check:status >= 400?
   → METADATA_ONLY(dead_link, check_error, check:status)
   → include check:url for diagnostics

3. type == "api" OR format matches /wms|wfs|ogc|arcgis/i?
   → API_METADATA(return url, ogc_metadata, link to dataservice if present)

4. type == "documentation" OR format in [pdf, html, document, png, jpg, jpeg]?
   → DOCUMENTATION_PREVIEW(preview_url, optional text extract if small)

5. extras["analysis:parsing:parsing_table"] present?
   → TABULAR_API
   → probe GET tabular-api/.../profile/ (200 → QUERYABLE)
   → attach parquet_url, preview_url, validation-report if present

6. format in [csv, csv.gz, tsv, xlsx, xls, ods] AND filetype == "file"?
   → attempt tabular profile (may 404)
   → if 404 AND analysis:error contains "too large":
        if resource_id in crawler_exceptions → TABULAR_API_LARGE
        else if parquet_url → PARQUET_ANALYTICS
        else → STREAM_PARSE_WITH_LIMITS
   → if 404 otherwise → STREAM_PARSE_WITH_LIMITS

7. format == "parquet" OR extras["analysis:parsing:parquet_url"]?
   → PARQUET_ANALYTICS

8. format in [geojson, json] OR extras["analysis:parsing:geojson_url"]?
   → GEOJSON_PREVIEW (use geojson_url if available)

9. format in [zip, shp, gpkg, kmz, kml]?
   → ARCHIVE_GEOSPATIAL_METADATA (list contents / bbox only)

10. filetype == "remote"?
    → REMOTE_FETCH_WITH_CAUTION(check:*, size from analysis:content-length)
    → never download if content-length > 100MB without explicit user intent

11. DEFAULT → METADATA_ONLY(format, mime, url, latest)
```

### Decision outputs

| Capability | Tools enabled |
|------------|---------------|
| `QUERYABLE` | `query_resource_data`, `get_resource_profile`, column filters |
| `TABULAR_API_LARGE` | Same, with pagination warnings |
| `PARQUET_ANALYTICS` | `read_parquet_sample`, column stats |
| `STREAM_PARSE` | `sample_resource_rows` (bounded) |
| `GEOJSON_PREVIEW` | `sample_geo_features` |
| `METADATA_ONLY` | `get_resource_info` only |

---

## 8. Dataset-level `format` filter (for search, not resource counts)

When using `GET /api/1/datasets/?format={fmt}`, counts reflect **datasets containing at least one resource** with that format:

| Format | Datasets |
|--------|----------|
| wms | 19,796 |
| wfs | 19,665 |
| csv | 26,878 |
| json | 15,738 |
| zip | 9,867 |
| pdf | 3,696 |
| geojson | 2,712 |
| shp | 2,509 |
| xls | 2,516 |
| xlsx | 2,359 |
| kml | 1,127 |
| gpkg | 593 |
| ods | 540 |
| parquet | 301 |
| xml | 583 |

Use the **resource catalog export** for accurate per-resource statistics.

---

## 9. Test fixtures (formats)

| Scenario | Resource ID |
|----------|-------------|
| Tabular CSV (small) | `a86ebc34-a979-4d6c-8f2a-9710a43dca93` |
| Tabular CSV (12.7M rows, exception) | `52200d61-5e80-4a4e-999f-6e1c184fa122` |
| Tabular XLSX | `45f3844f-0039-48ec-ade7-7dc8c429168b` |
| CSV not in Tabular API | `dbab1fa5-b902-4586-81e0-6063a6f96ca9` |
| Dead remote HTML | `4792c248-8b80-4524-8605-7d4213e49051` |
| Parquet (object.files) | `84719f62-cdd4-4d7c-b292-2aafa56c6043` |
| Validated schema (IRVE) | search `validation-report:schema_name` in catalog |
| WMS service endpoint | `202c55f0-6be6-4880-8055-9c6a03892857` |
| GeoJSON file | `7c257c68-14ec-495e-9823-99d30ccab111` |
| Catalog export itself | `4babf5f2-6a9c-45b5-9144-ca5eae6a7a6d` |
