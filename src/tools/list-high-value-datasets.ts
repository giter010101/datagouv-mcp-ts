import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { datasetToStructured, formatSearchResults } from "./search-datasets.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { datasetSummarySchema, pageOutputShape } from "./shared/output-schemas.js";
import { defineTool } from "./types.js";

export const HVD_BADGE = "hvd";

/**
 * EU High Value Dataset categories (Implementing Regulation 2023/138) → the French
 * tag slugs data.gouv.fr puts on HVD datasets (verified live 2026-09-03 with
 * `?badge=hvd&tag=…`: 12 / 582 / 36 / 25 / 2 / 6 datasets).
 */
export const HVD_CATEGORY_TAGS = {
  geospatial: "geospatiales",
  "earth-observation-environment": "observation-de-la-terre-et-environnement",
  meteorological: "meteorologiques",
  statistics: "statistiques",
  companies: "entreprises-et-propriete-dentreprises",
  mobility: "mobilite",
} as const;

export const HVD_CATEGORIES = Object.keys(HVD_CATEGORY_TAGS) as [
  keyof typeof HVD_CATEGORY_TAGS,
  ...Array<keyof typeof HVD_CATEGORY_TAGS>,
];

export const listHighValueDatasetsInputShape = {
  query: z.string().optional().describe("Optional keywords to search within HVD datasets."),
  category: z
    .enum(HVD_CATEGORIES)
    .optional()
    .describe("HVD thematic category: geospatial, earth-observation-environment, meteorological, statistics, companies, mobility."),
  organization: z.string().optional().describe("Organization ID facet."),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional().describe("Sort field (created, last_update, reuses, followers, views; '-' prefix = descending)."),
};

export const listHighValueDatasetsOutputShape = {
  query: z.string(),
  category: z.string().optional(),
  ...pageOutputShape,
  datasets: z.array(datasetSummarySchema),
};

export const listHighValueDatasetsTool = defineTool<typeof listHighValueDatasetsInputShape, ToolDeps>({
  name: "list_high_value_datasets",
  title: "List high value datasets (HVD)",
  description: [
    "Browse the High Value Datasets (HVD): datasets flagged under the EU Open Data Directive as",
    "having the highest socio-economic value (geospatial, earth observation & environment,",
    "meteorological, statistics, companies, mobility).",
    "",
    "Optional keywords, thematic `category` and `organization` narrow the list. Equivalent to",
    "search_datasets with badge='hvd'. Returns the same dataset summaries (ID, title, publisher,",
    "tags, resource count, URL); continue with get_dataset_resources_summary.",
  ].join("\n"),
  inputSchema: listHighValueDatasetsInputShape,
  outputSchema: listHighValueDatasetsOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const query = input.query?.trim() || "";
    const result = await ctx.deps.datagouv.searchDatasets({
      query,
      page: input.page,
      pageSize: input.page_size,
      sort: input.sort,
      filters: {
        badge: HVD_BADGE,
        organization: input.organization,
        tag: input.category ? [HVD_CATEGORY_TAGS[input.category]] : undefined,
      },
    });
    const label = query || `HVD${input.category ? ` / ${input.category}` : ""}`;
    return {
      text: formatSearchResults(label, result).replace(
        /^Found (\d+) dataset\(s\) for query/,
        "Found $1 high value dataset(s) for",
      ),
      structured: {
        query,
        category: input.category,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        datasets: result.items.map(datasetToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});
