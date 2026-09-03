import { z } from "zod";

/** schema.data.gouv.fr `schemas/schemas.json`, TableSchema documents and Validata reports. */

export const schemaCatalogEntrySchema = z.looseObject({
  name: z.string(),
  title: z.string().default(""),
  description: z.string().nullish(),
  schema_type: z.string().nullish(),
  schema_url: z.string().default(""),
  homepage: z.string().nullish(),
  consolidation_dataset_id: z.string().nullish(),
  versions: z
    .array(z.looseObject({ version_name: z.string(), schema_url: z.string().nullish() }))
    .nullish(),
});

export const schemaCatalogSchema = z.looseObject({
  version: z.string().nullish(),
  schemas: z.array(schemaCatalogEntrySchema).default([]),
});

export const tableSchemaFieldSchema = z.looseObject({
  name: z.string(),
  type: z.string().nullish(),
  description: z.string().nullish(),
  constraints: z.record(z.string(), z.unknown()).nullish(),
});

/** Frictionless TableSchema document (also accepts JSON Schema-ish docs with `properties`). */
export const tableSchemaDocumentSchema = z.looseObject({
  name: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  version: z.string().nullish(),
  fields: z.array(tableSchemaFieldSchema).nullish(),
  properties: z.record(z.string(), z.record(z.string(), z.unknown())).nullish(),
  required: z.array(z.string()).nullish(),
});

export const validataResponseSchema = z.looseObject({
  report: z
    .looseObject({
      valid: z.boolean().nullish(),
      stats: z
        .looseObject({
          errors: z.number().nullish(),
          warnings: z.number().nullish(),
          rows: z.number().nullish(),
        })
        .nullish(),
      errors: z.array(z.record(z.string(), z.unknown())).nullish(),
      warnings: z.array(z.string()).nullish(),
    })
    .nullish(),
  error: z.looseObject({ message: z.string().nullish(), type: z.string().nullish() }).nullish(),
});

export type SchemaCatalogEntryRaw = z.infer<typeof schemaCatalogEntrySchema>;
export type TableSchemaDocument = z.infer<typeof tableSchemaDocumentSchema>;
