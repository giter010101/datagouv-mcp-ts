import { z } from "zod";

/** metric-api.data.gouv.fr `/{model}/data/` envelope. Rows are `{ metric_month, <model>_id, monthly_* }`. */
export const metricsPageSchema = z.looseObject({
  data: z.array(z.record(z.string(), z.unknown())).default([]),
  links: z.looseObject({ next: z.string().nullish(), prev: z.string().nullish() }).nullish(),
  meta: z
    .looseObject({
      page: z.number().int().nullish(),
      page_size: z.number().int().nullish(),
      total: z.number().int().nullish(),
    })
    .nullish(),
});

export type MetricsPageResponse = z.infer<typeof metricsPageSchema>;
