import { decodeText } from "../download.js";
import { inferSchema } from "../infer.js";
import { geoJsonToTable, isGeoJson } from "../parsers/geojson.js";
import { parseJsonText } from "../parsers/json.js";
import type { FormatsDeps, PreviewResult, ResourceAccessor } from "../types.js";
import {
  DEFAULT_PREVIEW_LIMIT,
  downloadForAccess,
  queryParsedOrEngine,
  resourceUrl,
  tablePreview,
} from "./shared.js";

export function createGeojsonAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "geojson",
    capabilities: ["geo_preview", "stream_parse"],
    supports: (ctx) =>
      ctx.report.strategy === "geojson" ||
      ctx.report.detectedFormat === "geojson" ||
      ctx.report.detectedFormat === "topojson" ||
      ctx.report.urls.geojson !== undefined,
    async getSchema(ctx) {
      const preview = await this.preview(ctx, { limit: 50 });
      return preview.table
        ? inferSchema(preview.table.rows, {
            complete: !preview.table.truncated,
            rowCount:
              typeof preview.facts.featureCount === "number"
                ? preview.facts.featureCount
                : undefined,
          })
        : undefined;
    },
    async preview(ctx, options): Promise<PreviewResult> {
      const url = resourceUrl(ctx, "geojson");
      const download = await downloadForAccess(deps, ctx, url, "truncate");
      const text = decodeText(download.bytes, download.contentType).text;
      const doc = parseJsonText(text);
      const table = isGeoJson(doc)
        ? geoJsonToTable(doc, options?.limit ?? DEFAULT_PREVIEW_LIMIT)
        : geoJsonToTable({ type: "FeatureCollection", features: [] }, options?.limit);
      const schema = inferSchema(table.rows, {
        complete: !table.truncated,
        rowCount: table.featureCount,
      });
      const result = tablePreview({
        rows: table.rows,
        columns: table.columns,
        schema,
        facts: {
          featureCount: table.featureCount,
          bbox: table.bbox,
          geometryTypes: table.geometryTypes,
          crs: table.crs,
          source:
            ctx.report.urls.geojson && url === ctx.report.urls.geojson
              ? "hydra-geojson"
              : "geojson",
        },
        truncated: table.truncated || download.truncated,
      });
      return { ...result, kind: "features", features: table.rows };
    },
    query(ctx, spec) {
      const url = resourceUrl(ctx, "geojson");
      return queryParsedOrEngine(deps, ctx, "geojson", spec, url);
    },
  };
}
