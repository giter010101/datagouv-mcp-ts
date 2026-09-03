import { z } from "zod";
import { NotFoundError, UnsupportedCapabilityError } from "../core/errors.js";
import { truncate } from "../core/text.js";
import type { ReuseSummary } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { DETAIL_DESCRIPTION_CHARS, DETAIL_TAGS_MAX, kv, lines } from "./shared/formatters.js";
import { pageOutputShape } from "./shared/output-schemas.js";
import { defineTool } from "./types.js";

export const reuseSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  type: z.string().optional(),
  topic: z.string().optional(),
  organization: z.string().optional(),
  organization_id: z.string().optional(),
  datasets_count: z.number().int(),
  url: z.string(),
});

export const searchReusesInputShape = {
  query: z
    .string()
    .optional()
    .describe("Keywords. Omit to browse (optionally filtered by dataset_id)."),
  dataset_id: z.string().optional().describe("Only reuses built on this dataset (ID or slug)."),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
};

export const searchReusesOutputShape = {
  query: z.string().optional(),
  dataset_id: z.string().optional(),
  ...pageOutputShape,
  reuses: z.array(reuseSummarySchema),
};

export const searchReusesTool = defineTool<typeof searchReusesInputShape, ToolDeps>({
  name: "search_reuses",
  title: "Search reuses",
  description: [
    "Find reuses — applications, visualisations, articles, APIs — built on data.gouv.fr datasets.",
    "",
    "Search by keywords and/or restrict to the reuses of one dataset (`dataset_id`). Useful to see",
    "how a dataset is used in practice, to find inspiration, or to ground an answer with existing",
    "work. Returns title, type (application, visualization, api, post…), topic, organization,",
    "number of datasets used and the reuse page URL. Then call get_reuse_info for details.",
  ].join("\n"),
  inputSchema: searchReusesInputShape,
  outputSchema: searchReusesOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const result = await ctx.deps.datagouv.listReuses({
      query: input.query,
      datasetId: input.dataset_id,
      page: input.page,
      pageSize: input.page_size,
    });
    const label = [
      input.query ? `query '${input.query}'` : undefined,
      input.dataset_id ? `dataset ${input.dataset_id}` : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    const text: string[] = [];
    if (result.items.length === 0) {
      text.push(`No reuses found${label ? ` for ${label}` : ""}.`);
    } else {
      text.push(
        `Found ${result.total} reuse(s)${label ? ` for ${label}` : ""}`,
        `Page ${result.page} of results:`,
        "",
      );
      result.items.forEach((r, i) => {
        text.push(`${i + 1}. ${r.title || "Untitled"}`);
        text.push(`   ID: ${r.id}`);
        if (r.type) text.push(`   Type: ${r.type}${r.topic ? ` (topic: ${r.topic})` : ""}`);
        if (r.organization) text.push(`   Organization: ${r.organization.name}`);
        text.push(`   Datasets used: ${r.datasetsCount}`);
        text.push(`   URL: ${r.url}`, "");
      });
      if (result.hasNext) text.push(`More results available: use page=${result.page + 1}.`);
    }
    return {
      text: text.join("\n").trimEnd(),
      structured: {
        query: input.query,
        dataset_id: input.dataset_id,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        reuses: result.items.map(reuseToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

export function reuseToStructured(r: ReuseSummary) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    type: r.type,
    topic: r.topic,
    organization: r.organization?.name,
    organization_id: r.organization?.id,
    datasets_count: r.datasetsCount,
    url: r.url,
  };
}

export const getReuseInfoInputShape = {
  reuse_id: z.string().min(1).describe("Reuse ID or slug (from search_reuses)."),
};

export const getReuseInfoOutputShape = {
  reuse: reuseSummarySchema.extend({
    description: z.string(),
    tags: z.array(z.string()),
    datasets: z.array(z.object({ id: z.string(), title: z.string() })),
    created_at: z.string().optional(),
    last_modified: z.string().optional(),
    owner: z.string().optional(),
  }),
};

export const getReuseInfoTool = defineTool<typeof getReuseInfoInputShape, ToolDeps>({
  name: "get_reuse_info",
  title: "Get reuse info",
  description: [
    "Get the details of one reuse: description, type, topic, tags, publisher and the list of",
    "datasets it is built on (IDs usable with get_dataset_info / get_dataset_resources_summary).",
    "Use search_reuses first to find the reuse ID or slug.",
  ].join("\n"),
  inputSchema: getReuseInfoInputShape,
  outputSchema: getReuseInfoOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const getReuse = ctx.deps.datagouv.getReuse;
    if (!getReuse) {
      throw new UnsupportedCapabilityError(
        "Reuse details are not available with this catalogue client.",
        {
          hint: "Use search_reuses (which lists reuses with their URL) and open the reuse page.",
        },
      );
    }
    let reuse: Awaited<ReturnType<typeof getReuse>>;
    try {
      reuse = await getReuse.call(ctx.deps.datagouv, input.reuse_id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Error: Reuse with ID '${input.reuse_id}' not found.`, {
          cause: error,
          details: { reuse_id: input.reuse_id },
          hint: "Find the right reuse ID or slug with search_reuses.",
        });
      }
      throw error;
    }
    const text = lines(
      `Reuse: ${reuse.title || "Untitled"}`,
      "",
      kv("ID", reuse.id),
      kv("Slug", reuse.slug),
      kv("URL", reuse.url),
      kv("Type", reuse.type),
      kv("Topic", reuse.topic),
      reuse.organization
        ? `Organization: ${reuse.organization.name} (ID: ${reuse.organization.id})`
        : undefined,
      reuse.owner ? `Owner: ${reuse.owner.name}` : undefined,
      reuse.description ? "" : undefined,
      reuse.description
        ? `Description: ${truncate(reuse.description, DETAIL_DESCRIPTION_CHARS)}`
        : undefined,
      kv("Tags", reuse.tags.slice(0, DETAIL_TAGS_MAX)),
      kv("Created", reuse.createdAt),
      kv("Last modified", reuse.lastModified),
      "",
      `Datasets used (${reuse.datasets.length}):`,
      ...reuse.datasets.slice(0, 50).map((d) => `  - ${d.title} (ID: ${d.id})`),
    );
    return {
      text,
      structured: {
        reuse: {
          ...reuseToStructured(reuse),
          description: truncate(reuse.description, DETAIL_DESCRIPTION_CHARS),
          tags: reuse.tags.slice(0, DETAIL_TAGS_MAX),
          datasets: reuse.datasets.slice(0, 50),
          created_at: reuse.createdAt,
          last_modified: reuse.lastModified,
          owner: reuse.owner?.name,
        },
      },
    };
  },
});
