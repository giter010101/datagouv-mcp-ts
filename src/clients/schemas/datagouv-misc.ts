import { z } from "zod";
import { apiBadgeSchema } from "./datagouv-dataset.js";
import { apiOrganizationRefSchema } from "./datagouv-search.js";

/**
 * Zod schemas for the remaining udata payloads: organizations, dataservices,
 * reuses, topics, suggest, spatial, licenses, badges, site, registered schemas.
 */

export function apiPageSchema<T extends z.ZodType>(item: T) {
  return z.looseObject({
    data: z.array(item).default([]),
    page: z.number().int().nullish(),
    page_size: z.number().int().nullish(),
    total: z.number().int().nullish(),
    next_page: z.string().nullish(),
  });
}

export const apiOrganizationSchema = z.looseObject({
  id: z.string(),
  name: z.string().default(""),
  slug: z.string().default(""),
  acronym: z.string().nullish(),
  description: z.string().nullish(),
  business_number_id: z.string().nullish(),
  badges: z.array(apiBadgeSchema).nullish(),
  metrics: z.record(z.string(), z.unknown()).nullish(),
  page: z.string().nullish(),
  logo: z.string().nullish(),
  created_at: z.string().nullish(),
});

export const apiDataserviceSchema = z.looseObject({
  id: z.string(),
  title: z.string().default(""),
  slug: z.string().nullish(),
  description: z.string().nullish(),
  organization: apiOrganizationRefSchema,
  base_api_url: z.string().nullish(),
  machine_documentation_url: z.string().nullish(),
  business_documentation_url: z.string().nullish(),
  technical_documentation_url: z.string().nullish(),
  license: z.string().nullish(),
  availability: z.number().nullish(),
  access_type: z.string().nullish(),
  created_at: z.string().nullish(),
  metadata_modified_at: z.string().nullish(),
  self_web_url: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  datasets: z
    .union([z.array(z.unknown()), z.looseObject({ total: z.number().int().nullish() })])
    .nullish(),
});

export const apiReuseSchema = z.looseObject({
  id: z.string(),
  title: z.string().default(""),
  slug: z.string().default(""),
  description: z.string().nullish(),
  type: z.string().nullish(),
  topic: z.string().nullish(),
  page: z.string().nullish(),
  url: z.string().nullish(),
  organization: apiOrganizationRefSchema,
  owner: z
    .looseObject({
      id: z.string(),
      slug: z.string().nullish(),
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      page: z.string().nullish(),
    })
    .nullish(),
  tags: z.array(z.string()).nullish(),
  created_at: z.string().nullish(),
  last_modified: z.string().nullish(),
  datasets: z.array(z.looseObject({ id: z.string(), title: z.string().nullish() })).nullish(),
});

export const apiTopicSchema = z.looseObject({
  id: z.string(),
  name: z.string().default(""),
  slug: z.string().default(""),
  description: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  uri: z.string().nullish(),
  organization: apiOrganizationRefSchema,
  created_at: z.string().nullish(),
  last_modified: z.string().nullish(),
  featured: z.boolean().nullish(),
  elements: z
    .union([z.array(z.unknown()), z.looseObject({ total: z.number().int().nullish() })])
    .nullish(),
});

export const apiTopicElementSchema = z.looseObject({
  id: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  element: z.looseObject({ class: z.string().nullish(), id: z.string().nullish() }).nullish(),
});

export const apiSuggestDatasetSchema = z.looseObject({
  id: z.string(),
  slug: z.string().nullish(),
  title: z.string().default(""),
  page: z.string().nullish(),
});

export const apiSuggestOrganizationSchema = z.looseObject({
  id: z.string(),
  slug: z.string().nullish(),
  name: z.string().default(""),
  page: z.string().nullish(),
});

export const apiSuggestTextSchema = z.looseObject({ text: z.string() });

export const apiSpatialZoneSchema = z.looseObject({
  id: z.string(),
  code: z.string().default(""),
  name: z.string().default(""),
  level: z.string().default(""),
  uri: z.string().nullish(),
});

export const apiSpatialLevelSchema = z.looseObject({ id: z.string(), name: z.string().default("") });

export const apiLicenseSchema = z.looseObject({
  id: z.string(),
  title: z.string().default(""),
  url: z.string().nullish(),
  flags: z.array(z.string()).nullish(),
  alternate_urls: z.array(z.string()).nullish(),
});

export const apiBadgesSchema = z.record(z.string(), z.string());

export const apiSiteSchema = z.looseObject({
  id: z.string().default("data.gouv.fr"),
  title: z.string().default(""),
  version: z.string().nullish(),
  metrics: z.record(z.string(), z.unknown()).nullish(),
});

export const apiRegisteredSchemaSchema = z.looseObject({
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

export type ApiOrganization = z.infer<typeof apiOrganizationSchema>;
export type ApiDataservice = z.infer<typeof apiDataserviceSchema>;
export type ApiReuse = z.infer<typeof apiReuseSchema>;
export type ApiTopic = z.infer<typeof apiTopicSchema>;
export type ApiTopicElement = z.infer<typeof apiTopicElementSchema>;
export type ApiRegisteredSchema = z.infer<typeof apiRegisteredSchemaSchema>;
