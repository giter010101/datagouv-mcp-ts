import { z } from "zod";

/** Zod schemas for tabular-api.data.gouv.fr payloads (loose). */

export const tabularLinkSchema = z.looseObject({
  href: z.string().nullish(),
  rel: z.string().nullish(),
  type: z.string().nullish(),
});

export const tabularResourceMetaSchema = z.looseObject({
  created_at: z.string().nullish(),
  url: z.string().nullish(),
  links: z.array(tabularLinkSchema).nullish(),
});

/** csv-detective column descriptor (`columns` / `columns_fields` maps). */
export const tabularColumnInfoSchema = z.looseObject({
  format: z.string().nullish(),
  python_type: z.string().nullish(),
  score: z.number().nullish(),
});

export const tabularProfileSchema = z.looseObject({
  dataset_id: z.string().nullish(),
  indexes: z.unknown().nullish(),
  profile: z
    .looseObject({
      header: z.array(z.string()).nullish(),
      columns: z.record(z.string(), tabularColumnInfoSchema).nullish(),
      total_lines: z.number().nullish(),
      encoding: z.string().nullish(),
      separator: z.string().nullish(),
      profile: z.record(z.string(), z.record(z.string(), z.unknown())).nullish(),
    })
    .nullish(),
});

export const tabularDataPageSchema = z.looseObject({
  data: z.array(z.record(z.string(), z.unknown())).default([]),
  links: z
    .looseObject({
      next: z.string().nullish(),
      prev: z.string().nullish(),
      profile: z.string().nullish(),
      swagger: z.string().nullish(),
    })
    .nullish(),
  meta: z
    .looseObject({
      page: z.number().int().nullish(),
      page_size: z.number().int().nullish(),
      total: z.number().int().nullish(),
    })
    .nullish(),
});

export const tabularAggregationExceptionsSchema = z.looseObject({
  allowed: z.array(z.string()).default([]),
  exceptions: z.array(z.string()).default([]),
});

/** Error envelope: `{ errors: [{ code, title, detail }] }` — `detail` is a string or an object. */
export const tabularErrorBodySchema = z.looseObject({
  errors: z
    .array(
      z.looseObject({
        title: z.string().nullish(),
        detail: z.union([z.string(), z.looseObject({ message: z.string().nullish() })]).nullish(),
      }),
    )
    .nullish(),
});

export type TabularProfileResponse = z.infer<typeof tabularProfileSchema>;
export type TabularDataPageResponse = z.infer<typeof tabularDataPageSchema>;
