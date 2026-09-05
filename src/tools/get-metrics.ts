import { z } from "zod";
import type { MetricsRecord } from "../clients/types.js";
import { DatagouvError, toDatagouvError, ValidationError } from "../core/errors.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { defineTool } from "./types.js";

/**
 * The legacy README documented `limit` max 100 while the code clamped to 50.
 * We settle on 100 (ADR 0007 allows widening a clamp; the metrics client pages
 * the upstream API, whose page size is 50, when needed).
 */
export const METRICS_LIMIT_MAX = 100;
export const METRICS_LIMIT_DEFAULT = 12;

export const MSG_METRICS_DEMO =
  "Error: The Metrics API is not available in the demo environment.\n" +
  "The Metrics API only exists in production. Please set DATAGOUV_API_ENV=prod " +
  "to use this tool, or switch to production environment to access metrics data.";

export const getMetricsInputShape = {
  dataset_id: z
    .string()
    .optional()
    .describe("Dataset ID (24-hex). At least one of dataset_id / resource_id is required."),
  resource_id: z.string().optional().describe("Resource UUID."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(METRICS_LIMIT_MAX)
    .default(METRICS_LIMIT_DEFAULT)
    .describe(
      `Number of most recent months to return (1–${METRICS_LIMIT_MAX}, default ${METRICS_LIMIT_DEFAULT}).`,
    ),
};

const monthlyRow = z.object({
  month: z.string(),
  visits: z.number().optional(),
  downloads: z.number(),
});

const sectionSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    months: z.array(monthlyRow),
    total_visits: z.number().optional(),
    total_downloads: z.number(),
    error: z.string().optional(),
  })
  .optional();

export const getMetricsOutputShape = {
  limit: z.number().int(),
  dataset: sectionSchema,
  resource: sectionSchema,
};

export const getMetricsTool = defineTool<typeof getMetricsInputShape, ToolDeps>({
  name: "get_metrics",
  title: "Get usage metrics",
  legacy: true,
  description: [
    "Get usage metrics (visits, downloads) for a dataset or resource.",
    "",
    "Returns monthly statistics sorted by most recent first.",
    "At least one of dataset_id or resource_id must be provided.",
    `\`limit\` is the number of months (default ${METRICS_LIMIT_DEFAULT}, max ${METRICS_LIMIT_MAX}).`,
    "Note: Only available in production environment (not demo).",
    "Datasets report visits and resource downloads; resources report downloads only.",
  ].join("\n"),
  inputSchema: getMetricsInputShape,
  outputSchema: getMetricsOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    if (ctx.deps.config.datagouvApiEnv === "demo") {
      throw new DatagouvError("CONFIG_ERROR", MSG_METRICS_DEMO, {
        hint: "Restart the server with DATAGOUV_API_ENV=prod.",
      });
    }
    const datasetId = input.dataset_id?.trim();
    const resourceId = input.resource_id?.trim();
    if (!datasetId && !resourceId) {
      throw new ValidationError(
        "Error: At least one of dataset_id or resource_id must be provided.",
        {
          hint: "Pass dataset_id (from search_datasets) or resource_id (from list_dataset_resources).",
        },
      );
    }
    if (input.dataset_id !== undefined && !datasetId) {
      throw new ValidationError("Error: dataset_id cannot be empty.");
    }
    if (input.resource_id !== undefined && !resourceId) {
      throw new ValidationError("Error: resource_id cannot be empty.");
    }

    const text: string[] = [];
    const structured: Record<string, unknown> = { limit: input.limit };
    const failures: DatagouvError[] = [];

    if (datasetId) {
      const title = await bestEffort(() =>
        ctx.deps.datagouv.getDataset(datasetId).then((d) => d.title),
      );
      text.push(
        title ? `Dataset Metrics: ${title}` : "Dataset Metrics",
        `Dataset ID: ${datasetId}`,
        "",
      );
      try {
        const records = await ctx.deps.metrics.getMonthlyMetrics(
          "datasets",
          datasetId,
          input.limit,
        );
        const section = toSection(records, true);
        text.push(...renderSection(section, "dataset", true));
        structured.dataset = { id: datasetId, title, ...section };
      } catch (error) {
        const mapped = toDatagouvError(error);
        failures.push(mapped);
        text.push(`Error fetching dataset metrics: ${mapped.message}`);
        structured.dataset = {
          id: datasetId,
          title,
          months: [],
          total_downloads: 0,
          error: mapped.message,
        };
      }
      if (resourceId) text.push("", "");
    }

    if (resourceId) {
      const title = await bestEffort(() =>
        ctx.deps.datagouv.getResource(resourceId).then((r) => r.title),
      );
      text.push(
        title ? `Resource Metrics: ${title}` : "Resource Metrics",
        `Resource ID: ${resourceId}`,
        "",
      );
      try {
        const records = await ctx.deps.metrics.getMonthlyMetrics(
          "resources",
          resourceId,
          input.limit,
        );
        const section = toSection(records, false);
        text.push(...renderSection(section, "resource", false));
        structured.resource = { id: resourceId, title, ...section };
      } catch (error) {
        const mapped = toDatagouvError(error);
        failures.push(mapped);
        text.push(`Error fetching resource metrics: ${mapped.message}`);
        structured.resource = {
          id: resourceId,
          title,
          months: [],
          total_downloads: 0,
          error: mapped.message,
        };
      }
    }

    const sections = (datasetId ? 1 : 0) + (resourceId ? 1 : 0);
    if (failures.length === sections && failures[0]) {
      // Every requested section failed: surface it as a real error (legacy printed it in-band).
      throw failures[0];
    }
    return { text: text.join("\n"), structured };
  },
});

async function bestEffort<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

interface Section {
  months: Array<{ month: string; visits?: number; downloads: number }>;
  total_visits?: number;
  total_downloads: number;
}

function toSection(records: MetricsRecord[], withVisits: boolean): Section {
  const months = records.map((record) => {
    const downloads = record.values.monthly_download_resource ?? 0;
    const visits = record.values.monthly_visit ?? 0;
    return withVisits
      ? { month: record.month, visits, downloads }
      : { month: record.month, downloads };
  });
  const total_downloads = months.reduce((sum, m) => sum + m.downloads, 0);
  const total_visits = withVisits ? months.reduce((sum, m) => sum + (m.visits ?? 0), 0) : undefined;
  return withVisits ? { months, total_visits, total_downloads } : { months, total_downloads };
}

const pad = (value: string | number, width: number) =>
  (typeof value === "number" ? value.toLocaleString("en-US") : value).padEnd(width);

function renderSection(
  section: Section,
  kind: "dataset" | "resource",
  withVisits: boolean,
): string[] {
  if (section.months.length === 0) return [`No metrics available for this ${kind}.`];
  const width = withVisits ? 60 : 40;
  const rule = "-".repeat(width);
  const header = withVisits
    ? `${pad("Month", 12)} ${pad("Visits", 15)} ${pad("Downloads", 15)}`
    : `${pad("Month", 12)} ${pad("Downloads", 15)}`;
  const out = ["Monthly Statistics:", rule, header.trimEnd(), rule];
  for (const m of section.months) {
    out.push(
      withVisits
        ? `${pad(m.month, 12)} ${pad(m.visits ?? 0, 15)} ${pad(m.downloads, 15)}`.trimEnd()
        : `${pad(m.month, 12)} ${pad(m.downloads, 15)}`.trimEnd(),
    );
  }
  out.push(rule);
  out.push(
    withVisits
      ? `${pad("Total", 12)} ${pad(section.total_visits ?? 0, 15)} ${pad(section.total_downloads, 15)}`.trimEnd()
      : `${pad("Total", 12)} ${pad(section.total_downloads, 15)}`.trimEnd(),
  );
  return out;
}
