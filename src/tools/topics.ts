import { z } from "zod";
import { NotFoundError } from "../core/errors.js";
import { truncate } from "../core/text.js";
import type { DatasetSummary, TopicElement, TopicSummary } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { datasetToStructured } from "./search-datasets.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import {
  DETAIL_DESCRIPTION_CHARS,
  LIST_DESCRIPTION_CHARS,
  LIST_TAGS_MAX,
} from "./shared/formatters.js";
import { datasetSummarySchema, pageOutputShape } from "./shared/output-schemas.js";
import { defineTool } from "./types.js";

export const topicSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description_short: z.string(),
  tags: z.array(z.string()),
  url: z.string(),
});

export const listTopicsInputShape = {
  query: z.string().default("").describe("Keywords to filter topics; empty lists all topics."),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
};

export const listTopicsOutputShape = {
  query: z.string(),
  ...pageOutputShape,
  topics: z.array(topicSummarySchema),
};

export const listTopicsTool = defineTool<typeof listTopicsInputShape, ToolDeps>({
  name: "list_topics",
  title: "List topics",
  description: [
    "List curated topics (thematic collections of datasets and reuses maintained on data.gouv.fr),",
    "optionally filtered by keywords.",
    "",
    "Topics are the best entry point for broad themes (e.g. transport, energy, elections): call",
    "get_topic to see the datasets a topic groups, or pass the topic ID as the `topic` facet of",
    "search_datasets. Returns name, ID, slug, short description, tags and URL.",
  ].join("\n"),
  inputSchema: listTopicsInputShape,
  outputSchema: listTopicsOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const result = await ctx.deps.datagouv.searchTopics(input.query, input.page, input.page_size);
    const text: string[] = [];
    if (result.items.length === 0) {
      text.push(input.query ? `No topics found for query: '${input.query}'` : "No topics found.");
    } else {
      text.push(
        `Found ${result.total} topic(s)${input.query ? ` for query: '${input.query}'` : ""}`,
        `Page ${result.page} of results:`,
        "",
      );
      result.items.forEach((t, i) => {
        text.push(`${i + 1}. ${t.name || "Untitled"}`);
        text.push(`   ID: ${t.id}`);
        if (t.description)
          text.push(`   Description: ${truncate(t.description, LIST_DESCRIPTION_CHARS)}`);
        if (t.tags.length > 0) text.push(`   Tags: ${t.tags.slice(0, LIST_TAGS_MAX).join(", ")}`);
        text.push(`   URL: ${t.url}`, "");
      });
      if (result.hasNext) text.push(`More results available: use page=${result.page + 1}.`);
    }
    return {
      text: text.join("\n").trimEnd(),
      structured: {
        query: input.query,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        topics: result.items.map(topicToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

export function topicToStructured(t: TopicSummary) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description_short: truncate(t.description, LIST_DESCRIPTION_CHARS),
    tags: t.tags,
    url: t.url,
  };
}

export const getTopicInputShape = {
  topic_id: z.string().min(1).describe("Topic ID or slug (from list_topics)."),
};

export const getTopicOutputShape = {
  topic: topicSummarySchema.extend({ description: z.string() }),
  datasets_count: z.number().int(),
  datasets: z.array(datasetSummarySchema),
};

export const getTopicTool = defineTool<typeof getTopicInputShape, ToolDeps>({
  name: "get_topic",
  title: "Get topic",
  description: [
    "Get a topic (curated collection) with its description and the datasets it groups.",
    "",
    "Returns the topic metadata and, for each dataset: title, ID, publisher, tags, resource count",
    "and URL — ready for get_dataset_resources_summary. Large topics are capped to 100 datasets;",
    "use search_datasets with the `topic` facet to page through all of them.",
  ].join("\n"),
  inputSchema: getTopicInputShape,
  outputSchema: getTopicOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    let topic: Awaited<ReturnType<ToolDeps["datagouv"]["getTopic"]>>;
    try {
      topic = await ctx.deps.datagouv.getTopic(input.topic_id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Error: Topic with ID '${input.topic_id}' not found.`, {
          cause: error,
          details: { topic_id: input.topic_id },
          hint: "Find the topic ID or slug with list_topics.",
        });
      }
      throw error;
    }

    const isDatasetElement = (
      e: TopicElement,
    ): e is TopicElement & { elementId: string; elementClass: string } =>
      e.elementClass?.toLowerCase() === "dataset" &&
      typeof e.elementId === "string" &&
      e.elementId.length > 0;

    const datasetElements = topic.elements.filter(isDatasetElement).slice(0, 100);
    const datasetDetails: DatasetSummary[] = await Promise.all(
      datasetElements.map((e) => ctx.deps.datagouv.getDataset(e.elementId)),
    );

    const text = [
      `Topic: ${topic.name || "Untitled"}`,
      `ID: ${topic.id} (slug: ${topic.slug})`,
      `URL: ${topic.url}`,
      topic.tags.length > 0 ? `Tags: ${topic.tags.slice(0, 10).join(", ")}` : undefined,
      topic.description ? "" : undefined,
      topic.description
        ? `Description: ${truncate(topic.description, DETAIL_DESCRIPTION_CHARS)}`
        : undefined,
      "",
      `Datasets (${datasetElements.length}):`,
      ...datasetDetails.map(
        (d, i) =>
          `  ${i + 1}. ${d.title} (ID: ${d.id})${d.organization ? ` — ${d.organization.name}` : ""} — ${d.resourcesCount} resource(s)`,
      ),
    ].filter((l): l is string => l !== undefined);

    return {
      text: text.join("\n"),
      structured: {
        topic: {
          ...topicToStructured(topic),
          description: truncate(topic.description, DETAIL_DESCRIPTION_CHARS),
        },
        datasets_count: datasetElements.length,
        datasets: datasetDetails.map(datasetToStructured),
      },
      howToGetMore: `Use search_datasets with topic='${topic.id}' to page through all datasets.`,
    };
  },
});
