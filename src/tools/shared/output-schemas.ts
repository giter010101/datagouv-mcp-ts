import { z } from "zod";

/**
 * Reusable fragments for tool `outputSchema`s. All optional-friendly: the SDK
 * validates `structuredContent` against these on success, so a strict schema
 * would turn a harmless formatting difference into a protocol error.
 */

export const pageOutputShape = {
  total: z.number().int().describe("Total number of matches."),
  page: z.number().int(),
  page_size: z.number().int(),
  has_next: z.boolean().describe("True when another page exists (use page+1)."),
};

export const organizationRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    url: z.string().optional(),
  })
  .optional();

export const datasetSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description_short: z.string(),
  organization: z.string().optional(),
  organization_id: z.string().optional(),
  tags: z.array(z.string()),
  resources_count: z.number().int(),
  last_update: z.string().optional(),
  license: z.string().optional(),
  url: z.string(),
});

export const capabilityReportSchema = z.object({
  primary: z.string().describe("Best access capability (tabular_api, parquet, stream_parse, …)."),
  capabilities: z.array(z.string()),
  format_family: z.string(),
  detected_format: z.string(),
  size_bytes: z.number().optional(),
  tabular_probe: z.string(),
  urls: z.object({
    download: z.string(),
    latest: z.string(),
    parquet: z.string().optional(),
    geojson: z.string().optional(),
    preview: z.string().optional(),
    tabular_api: z.string().optional(),
  }),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  recommended_tool: z.string().describe("Tool to call next for this resource."),
  recommendation: z.string(),
});

export const tableSchemaSchema = z.object({
  source: z.string(),
  row_count: z.number().optional(),
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      native_type: z.string().optional(),
      nullable: z.boolean().optional(),
      stats: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export const tableSliceShape = {
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  total: z.number().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
  has_next: z.boolean(),
  truncated: z.boolean(),
};

export const resourceSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  format: z.string(),
  mime: z.string().optional(),
  type: z.string(),
  filetype: z.string(),
  filesize: z.number().optional(),
  size_human: z.string().optional(),
  url: z.string(),
  latest_url: z.string(),
  last_modified: z.string().optional(),
  access_hint: z.string().optional(),
  recommended_tool: z.string().optional(),
});
