import { z } from "zod";
import { UnsupportedCapabilityError } from "../core/errors.js";
import type { TableSchema } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { recommendationFor } from "./shared/capability-hints.js";
import { renderSchema } from "./shared/formatters.js";
import { tableSchemaSchema } from "./shared/output-schemas.js";
import { openResource, requireAccessor } from "./shared/resource-access.js";
import { mapTabularError } from "./shared/tabular-errors.js";
import { defineTool } from "./types.js";

export const getResourceSchemaInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID."),
};

export const getResourceSchemaOutputShape = {
  resource_id: z.string(),
  title: z.string(),
  capability: z.string(),
  accessor: z.string(),
  schema: tableSchemaSchema,
  declared_schema: z
    .object({ name: z.string(), version: z.string().optional(), url: z.string().optional() })
    .optional(),
  next_tool: z.string(),
};

export const getResourceSchemaTool = defineTool<typeof getResourceSchemaInputShape, ToolDeps>({
  name: "get_resource_schema",
  title: "Get resource schema",
  description: [
    "Return the columns (name, type) and, when known, the row count of any queryable resource.",
    "",
    "Sources, by preference: Tabular API profile, Parquet footer, inference from a bounded sample",
    "of the file (CSV/XLSX/JSON…), or the schema.data.gouv.fr schema declared on the resource.",
    "Call it before query_resource / query_resource_data to get exact column names for filters",
    "and sorts. Not applicable to documents, archives, images or API endpoints (use preview_resource",
    "or get_resource_info instead).",
  ].join("\n"),
  inputSchema: getResourceSchemaInputShape,
  outputSchema: getResourceSchemaOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const opened = await openResource(ctx.deps, input.resource_id, { signal: ctx.signal });
    const accessor = requireAccessor(opened, "schema");
    let schema: TableSchema | undefined;
    try {
      schema = await accessor.getSchema(opened.ctx);
    } catch (error) {
      throw opened.report.primary.startsWith("tabular_api")
        ? mapTabularError(error, input.resource_id)
        : error;
    }
    if (!schema) {
      throw new UnsupportedCapabilityError(
        `No schema could be derived for resource ${input.resource_id} (capability '${opened.report.primary}', accessor '${accessor.id}').`,
        {
          details: { resource_id: input.resource_id, primary: opened.report.primary },
          hint: "Use preview_resource to look at the first rows, or get_resource_info for the download URL.",
        },
      );
    }
    const rec = recommendationFor(opened.report.primary);
    const text = [
      `Schema of resource: ${opened.resource.title || "Untitled"}`,
      `Resource ID: ${opened.resource.id}`,
      `Access: ${opened.report.primary} via ${accessor.id}`,
      opened.resource.schema
        ? `Declared schema: ${opened.resource.schema.name}${opened.resource.schema.version ? ` v${opened.resource.schema.version}` : ""} (see get_schema_info)`
        : undefined,
      "",
      ...renderSchema(schema),
      "",
      `Next: ${rec.tool} with filters on these column names.`,
    ].filter((l): l is string => l !== undefined);
    return {
      text: text.join("\n"),
      structured: {
        resource_id: opened.resource.id,
        title: opened.resource.title,
        capability: opened.report.primary,
        accessor: accessor.id,
        schema: schemaToStructured(schema),
        declared_schema: opened.resource.schema,
        next_tool: rec.tool,
      },
    };
  },
});

export function schemaToStructured(schema: TableSchema) {
  return {
    source: schema.source,
    row_count: schema.rowCount,
    columns: schema.columns.map((c) => ({
      name: c.name,
      type: c.type,
      native_type: c.nativeType,
      nullable: c.nullable,
      stats: c.stats,
    })),
  };
}
