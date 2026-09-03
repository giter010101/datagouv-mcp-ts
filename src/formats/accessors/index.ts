import type { FormatsDeps, ResourceAccessor } from "../types.js";
import { createApiEndpointAccessor, createMetadataAccessor } from "./api-metadata.js";
import { createArchiveAccessor } from "./archive.js";
import { createCsvAccessor, createParquetAccessor } from "./csv-parquet.js";
import { createDocumentAccessor } from "./document.js";
import { createGeojsonAccessor } from "./geojson.js";
import { createShapefileAccessor } from "./shapefile.js";
import { createJsonAccessor, createSpreadsheetAccessor, createXmlAccessor } from "./structured.js";
import { createHydraParquetAccessor, createTabularApiAccessor } from "./tabular.js";

/**
 * Default accessor set, best-capability first within each capability bucket.
 * `metadata-only` is last and always matches.
 */
export function defaultAccessors(deps: FormatsDeps): ResourceAccessor[] {
  return [
    createTabularApiAccessor(deps),
    createHydraParquetAccessor(deps),
    createParquetAccessor(deps),
    createCsvAccessor(deps),
    createSpreadsheetAccessor(deps),
    createJsonAccessor(deps),
    createGeojsonAccessor(deps),
    createXmlAccessor(deps),
    createShapefileAccessor(deps),
    createArchiveAccessor(deps),
    createDocumentAccessor(deps),
    createApiEndpointAccessor(),
    createMetadataAccessor(),
  ];
}
