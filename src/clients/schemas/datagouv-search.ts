import { z } from "zod";

/**
 * Zod schemas for the subset of udata API v2 `/datasets/search/` we rely on.
 * Loose objects: udata adds fields regularly and we must not break on them.
 */

export const apiOrganizationRefSchema = z
  .looseObject({
    id: z.string(),
    name: z.string().default(""),
    slug: z.string().nullish(),
    page: z.string().nullish(),
  })
  .nullish();

export const apiDatasetSearchItemSchema = z.looseObject({
  id: z.string(),
  slug: z.string().default(""),
  title: z.string().default(""),
  description_short: z.string().nullish(),
  description: z.string().nullish(),
  organization: apiOrganizationRefSchema,
  tags: z.array(z.string()).nullish(),
  resources: z.looseObject({ total: z.number().int().nullish() }).nullish(),
  last_update: z.string().nullish(),
  license: z.string().nullish(),
});

export const apiDatasetSearchResponseSchema = z.looseObject({
  data: z.array(apiDatasetSearchItemSchema).default([]),
  page: z.number().int().nullish(),
  page_size: z.number().int().nullish(),
  total: z.number().int().nullish(),
  next_page: z.string().nullish(),
});

export type ApiDatasetSearchItem = z.infer<typeof apiDatasetSearchItemSchema>;
export type ApiDatasetSearchResponse = z.infer<typeof apiDatasetSearchResponseSchema>;
