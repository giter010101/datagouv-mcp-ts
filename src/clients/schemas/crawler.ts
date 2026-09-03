import { z } from "zod";

/** crawler.data.gouv.fr (Hydra) payloads. */

export const crawlerExceptionsSchema = z.array(
  z.looseObject({
    id: z.union([z.string(), z.number()]).nullish(),
    resource_id: z.string().nullish(),
    table_indexes: z.unknown().nullish(),
    comment: z.string().nullish(),
  }),
);

export const crawlerHealthSchema = z.looseObject({
  version: z.string().nullish(),
  environment: z.string().nullish(),
});
