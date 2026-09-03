import shp from "shpjs";
import { FormatError } from "../../core/errors.js";
import { inferSchema } from "../infer.js";
import { geoJsonToTable } from "../parsers/geojson.js";
import type { FormatsDeps, ResourceAccessor } from "../types.js";
import { listZipEntries } from "./archive.js";
import {
  DEFAULT_PREVIEW_LIMIT,
  downloadForAccess,
  resourceUrl,
  tablePreview,
  unsupportedQuery,
} from "./shared.js";

type GeoJsonDoc = { type?: string; features?: unknown[] };

async function parseShapefileZip(bytes: Uint8Array): Promise<GeoJsonDoc> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  try {
    const result = (await shp(copy)) as GeoJsonDoc | GeoJsonDoc[];
    if (Array.isArray(result)) {
      const features = result.flatMap((fc) => (Array.isArray(fc.features) ? fc.features : []));
      return { type: "FeatureCollection", features };
    }
    return result;
  } catch (error) {
    throw new FormatError(
      `Could not parse shapefile: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
        hint: "Shapefiles must be a ZIP containing .shp/.dbf/.shx; only small archives are parsed in-process.",
      },
    );
  }
}

export function createShapefileAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "shapefile",
    capabilities: ["archive_inspect", "geo_preview"],
    supports: (ctx) => ctx.report.strategy === "shapefile" || ctx.report.detectedFormat === "shp",
    async getSchema(ctx) {
      const preview = await this.preview(ctx, { limit: 20 });
      return preview.table
        ? inferSchema(preview.table.rows, {
            rowCount:
              typeof preview.facts.featureCount === "number"
                ? preview.facts.featureCount
                : undefined,
          })
        : undefined;
    },
    async preview(ctx, options) {
      const download = await downloadForAccess(deps, ctx, resourceUrl(ctx), "throw");
      const { entries } = listZipEntries(download.bytes);
      const geo = await parseShapefileZip(download.bytes);
      const table = geoJsonToTable(geo, options?.limit ?? DEFAULT_PREVIEW_LIMIT);
      const schema = inferSchema(table.rows, {
        complete: !table.truncated,
        rowCount: table.featureCount,
      });
      const preview = tablePreview({
        rows: table.rows,
        columns: table.columns,
        schema,
        facts: {
          featureCount: table.featureCount,
          bbox: table.bbox,
          geometryTypes: table.geometryTypes,
          entries: entries.map((e) => e.name),
        },
        truncated: table.truncated,
      });
      return { ...preview, kind: "features", features: table.rows, entries };
    },
    query(ctx) {
      return unsupportedQuery(ctx, "shapefile");
    },
  };
}
