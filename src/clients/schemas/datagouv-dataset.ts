import { z } from "zod";
import { apiOrganizationRefSchema } from "./datagouv-search.js";

/**
 * Zod schemas for udata dataset / resource payloads (API v1 `/datasets/{id}/`,
 * API v2 `/datasets/resources/{rid}/` and `/datasets/{id}/resources/`).
 * Loose objects: only the fields we read are typed; unknown fields pass through.
 */

export const apiSchemaRefSchema = z
  .looseObject({
    name: z.string().nullish(),
    version: z.string().nullish(),
    url: z.string().nullish(),
  })
  .nullish();

export const apiBadgeSchema = z.looseObject({ kind: z.string() });

export const apiResourceSchema = z.looseObject({
  id: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  format: z.string().nullish(),
  mime: z.string().nullish(),
  type: z.string().nullish(),
  filetype: z.string().nullish(),
  filesize: z.number().nullish(),
  url: z.string().default(""),
  latest: z.string().nullish(),
  preview_url: z.string().nullish(),
  created_at: z.string().nullish(),
  last_modified: z.string().nullish(),
  checksum: z.looseObject({ type: z.string().nullish(), value: z.string().nullish() }).nullish(),
  schema: apiSchemaRefSchema,
  extras: z.record(z.string(), z.unknown()).nullish(),
});

export const apiDatasetDetailSchema = z.looseObject({
  id: z.string(),
  slug: z.string().default(""),
  title: z.string().default(""),
  description: z.string().nullish(),
  description_short: z.string().nullish(),
  organization: apiOrganizationRefSchema,
  tags: z.array(z.string()).nullish(),
  license: z.string().nullish(),
  frequency: z.string().nullish(),
  created_at: z.string().nullish(),
  last_update: z.string().nullish(),
  last_modified: z.string().nullish(),
  temporal_coverage: z
    .looseObject({ start: z.string().nullish(), end: z.string().nullish() })
    .nullish(),
  spatial: z
    .looseObject({
      zones: z.array(z.string()).nullish(),
      granularity: z.string().nullish(),
    })
    .nullish(),
  badges: z.array(apiBadgeSchema).nullish(),
  schema: apiSchemaRefSchema,
  quality: z.record(z.string(), z.unknown()).nullish(),
  page: z.string().nullish(),
  /** v1 embeds the array; v2 returns a `{ rel, href, total }` link. */
  resources: z
    .union([z.array(apiResourceSchema), z.looseObject({ total: z.number().int().nullish() })])
    .nullish(),
});

export const apiResourceEnvelopeSchema = z.looseObject({
  resource: apiResourceSchema,
  dataset_id: z.string().nullish(),
});

export const apiResourcesPageSchema = z.looseObject({
  data: z.array(apiResourceSchema).default([]),
  page: z.number().int().nullish(),
  page_size: z.number().int().nullish(),
  total: z.number().int().nullish(),
  next_page: z.string().nullish(),
});

export type ApiResource = z.infer<typeof apiResourceSchema>;
export type ApiDatasetDetail = z.infer<typeof apiDatasetDetailSchema>;
export type ApiSchemaRef = z.infer<typeof apiSchemaRefSchema>;
