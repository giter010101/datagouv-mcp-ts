import type { FormatFamily } from "./types.js";

/**
 * Normalisation of the publisher-declared `format` / `mime` / URL extension into
 * a small controlled vocabulary. data.gouv.fr has 74k resources with an empty
 * format and hundreds of spellings ("ESRI Shapefile", "web page", "ogc:wms"…).
 */

const FORMAT_ALIASES: Record<string, string> = {
  "csv.gz": "csv.gz",
  "csv gz": "csv.gz",
  csvgz: "csv.gz",
  "text/csv": "csv",
  tsv: "tsv",
  tab: "tsv",
  txt: "txt",
  text: "txt",
  xlsx: "xlsx",
  xlsm: "xlsx",
  xls: "xls",
  excel: "xls",
  ods: "ods",
  json: "json",
  jsonl: "jsonl",
  ndjson: "jsonl",
  "json lines": "jsonl",
  geojson: "geojson",
  topojson: "topojson",
  kml: "kml",
  kmz: "kmz",
  gpx: "gpx",
  gml: "gml",
  shp: "shp",
  shapefile: "shp",
  "esri shapefile": "shp",
  "shapefile (shp)": "shp",
  "shape file": "shp",
  gpkg: "gpkg",
  geopackage: "gpkg",
  "mapinfo tab": "mapinfo",
  mif: "mapinfo",
  dbf: "dbf",
  parquet: "parquet",
  xml: "xml",
  rdf: "rdf",
  ttl: "ttl",
  turtle: "ttl",
  n3: "n3",
  pdf: "pdf",
  zip: "zip",
  "7z": "7z",
  "tar.gz": "tar.gz",
  tgz: "tar.gz",
  tar: "tar",
  gz: "gzip",
  gzip: "gzip",
  html: "html",
  htm: "html",
  "web page": "html",
  webpage: "html",
  "page web": "html",
  url: "url",
  api: "api",
  wms: "wms",
  "ogc:wms": "wms",
  wfs: "wfs",
  "ogc:wfs": "wfs",
  wmts: "wmts",
  "ogc:wmts": "wmts",
  "ogc api": "ogcapi",
  arcgis: "arcgis",
  "arcgis geoservices rest api": "arcgis",
  "esri rest": "arcgis",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  gif: "gif",
  tiff: "tiff",
  tif: "tiff",
  geotiff: "tiff",
  docx: "docx",
  doc: "doc",
  odt: "odt",
  md: "md",
  markdown: "md",
  document: "document",
  documentation: "document",
  ics: "ics",
  grib2: "grib2",
  grib: "grib2",
  netcdf: "netcdf",
  nc: "netcdf",
  sqlite: "sqlite",
  db: "sqlite",
  mdb: "mdb",
  yaml: "yaml",
  yml: "yaml",
};

const MIME_TO_FORMAT: Record<string, string> = {
  "text/csv": "csv",
  "application/csv": "csv",
  "text/tab-separated-values": "tsv",
  "text/plain": "txt",
  "application/json": "json",
  "application/ld+json": "json",
  "application/x-ndjson": "jsonl",
  "application/geo+json": "geojson",
  "application/vnd.geo+json": "geojson",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/xls": "xls",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-7z-compressed": "7z",
  "application/gzip": "gzip",
  "application/x-gzip": "gzip",
  "application/x-tar": "tar",
  "application/pdf": "pdf",
  "text/html": "html",
  "application/xhtml+xml": "html",
  "text/xml": "xml",
  "application/xml": "xml",
  "application/gml+xml": "gml",
  "application/vnd.google-earth.kml+xml": "kml",
  "application/vnd.google-earth.kmz": "kmz",
  "application/parquet": "parquet",
  "application/vnd.apache.parquet": "parquet",
  "application/geopackage+sqlite3": "gpkg",
  "application/x-esri-shape": "shp",
  "application/dbf": "dbf",
  "application/x-dbf": "dbf",
  "text/turtle": "ttl",
  "application/n-triples": "n3",
  "application/rdf+xml": "rdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/markdown": "md",
  "text/calendar": "ics",
  "application/vnd.ogc.wms_xml": "wms",
  "application/vnd.sqlite3": "sqlite",
};

/** Normalise a declared format string; `undefined` when empty/unknown. */
export function normalizeFormat(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase().replace(/^\./, "");
  if (key === "") return undefined;
  const alias = FORMAT_ALIASES[key];
  if (alias) return alias;
  const mime = MIME_TO_FORMAT[key];
  if (mime) return mime;
  if (/^[a-z0-9]{1,10}$/.test(key)) return key;
  return undefined;
}

export function formatFromMime(mime: string | undefined | null): string | undefined {
  if (!mime) return undefined;
  const type = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_FORMAT[type];
}

/** Extension of the URL path (`.csv.gz` → `csv.gz`), ignoring the query string. */
export function formatFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  const lower = last.toLowerCase();
  if (lower.endsWith(".csv.gz")) return "csv.gz";
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  const dot = lower.lastIndexOf(".");
  if (dot === -1 || dot === lower.length - 1) return undefined;
  const ext = lower.slice(dot + 1);
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return undefined;
  return normalizeFormat(ext);
}

export const TABULAR_FILE_FORMATS: ReadonlySet<string> = new Set(["csv", "csv.gz", "tsv"]);
export const SPREADSHEET_FORMATS: ReadonlySet<string> = new Set(["xlsx", "xls", "ods"]);
export const JSON_FORMATS: ReadonlySet<string> = new Set(["json", "jsonl"]);
export const GEO_FILE_FORMATS: ReadonlySet<string> = new Set(["geojson", "topojson", "kml", "gpx"]);
export const ARCHIVE_FORMATS: ReadonlySet<string> = new Set([
  "zip",
  "7z",
  "tar.gz",
  "tar",
  "kmz",
  "shp",
  "gpkg",
  "dbf",
  "mapinfo",
]);
export const DOCUMENT_FORMATS: ReadonlySet<string> = new Set([
  "pdf",
  "html",
  "document",
  "docx",
  "doc",
  "odt",
  "md",
  "txt",
  "rdf",
  "ttl",
  "n3",
  "yaml",
  "ics",
]);
export const IMAGE_FORMATS: ReadonlySet<string> = new Set(["png", "jpeg", "gif", "tiff"]);
export const API_FORMATS: ReadonlySet<string> = new Set([
  "wms",
  "wfs",
  "wmts",
  "ogcapi",
  "arcgis",
  "api",
  "url",
]);
export const XML_FORMATS: ReadonlySet<string> = new Set(["xml", "gml"]);

export function familyOf(format: string | undefined): FormatFamily {
  if (!format) return "unknown";
  if (TABULAR_FILE_FORMATS.has(format) || format === "parquet") return "tabular";
  if (SPREADSHEET_FORMATS.has(format)) return "spreadsheet";
  if (JSON_FORMATS.has(format)) return "json";
  if (GEO_FILE_FORMATS.has(format) || format === "shp" || format === "gpkg" || format === "kmz") {
    return "geo";
  }
  if (ARCHIVE_FORMATS.has(format) || format === "gzip") return "archive";
  if (format === "rdf" || format === "ttl" || format === "n3") return "rdf";
  if (DOCUMENT_FORMATS.has(format)) return "document";
  if (IMAGE_FORMATS.has(format)) return "image";
  if (API_FORMATS.has(format)) return "api";
  if (XML_FORMATS.has(format)) return "xml";
  return "unknown";
}
