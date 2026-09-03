import { z } from "zod";
import type { TabularFilter, TabularOperator, TabularSort } from "../clients/types.js";
import { ValidationError } from "../core/errors.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { renderRowsLegacy } from "./shared/formatters.js";
import { tableSliceShape } from "./shared/output-schemas.js";
import { mapTabularError } from "./shared/tabular-errors.js";
import { defineTool } from "./types.js";

/** Legacy operators first, then the two additive ones (ADR 0007 §1). */
export const TABULAR_OPERATORS: readonly TabularOperator[] = [
  "exact",
  "contains",
  "less",
  "greater",
  "strictly_less",
  "strictly_greater",
  "differs",
  "in",
];

export const LARGE_DATASET_ROWS = 1000;

export const queryResourceDataInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID (from list_dataset_resources)."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe("Rows per page (1–200). Start with 20 to discover the columns."),
  filter_column: z.string().optional().describe("Column to filter on (exact name from the data)."),
  filter_value: z
    .string()
    .optional()
    .describe("Filter value (required with filter_column). For operator 'in', separate values with commas."),
  filter_operator: z
    .string()
    .default("exact")
    .describe(
      "One of: exact, contains, less, greater, strictly_less, strictly_greater, differs, in. 'less'/'greater' are inclusive.",
    ),
  sort_column: z.string().optional().describe("Column to sort by."),
  sort_direction: z.string().default("asc").describe("asc or desc."),
};

export const queryResourceDataOutputShape = {
  resource_id: z.string(),
  resource_title: z.string(),
  dataset_id: z.string().optional(),
  dataset_title: z.string().optional(),
  filter: z
    .object({ column: z.string(), operator: z.string(), value: z.string() })
    .optional(),
  sort: z.object({ column: z.string(), direction: z.string() }).optional(),
  total_pages: z.number().int().optional(),
  ...tableSliceShape,
};

export const queryResourceDataTool = defineTool<typeof queryResourceDataInputShape, ToolDeps>({
  name: "query_resource_data",
  title: "Query resource data",
  legacy: true,
  description: [
    "Query tabular data from a resource via the Tabular API (no download needed).",
    "",
    "Works for CSV/XLSX files. Start with small page_size (20) to preview structure.",
    "Use filter_column/filter_value/filter_operator to filter, sort_column/sort_direction to sort.",
    "Filter operators: exact, contains, less, greater, strictly_less, strictly_greater, differs, in.",
    "For large datasets requiring full analysis, paginate through pages or use",
    "get_resource_info to retrieve the raw file URL and fetch it directly.",
    "",
    "Only resources indexed by the Tabular API work here (check with get_resource_info or",
    "check_resource_availability). For other formats (JSON, GeoJSON, Parquet, XLSX too large, …)",
    "use the format-agnostic query_resource / preview_resource tools instead.",
    "Returns the total row count, the page, the column names and the rows (cells capped at 100 chars).",
  ].join("\n"),
  inputSchema: queryResourceDataInputShape,
  outputSchema: queryResourceDataOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const operator = input.filter_operator.toLowerCase();
    const direction = input.sort_direction.toLowerCase();
    const hasFilter = input.filter_column !== undefined && input.filter_value !== undefined;
    if (hasFilter && !TABULAR_OPERATORS.includes(operator as TabularOperator)) {
      throw new ValidationError(
        `Error: invalid filter_operator. Supported values: ${[...TABULAR_OPERATORS].sort().join(", ")}.`,
      );
    }
    if (input.sort_column && direction !== "asc" && direction !== "desc") {
      throw new ValidationError("Error: invalid sort_direction. Supported values: asc, desc.");
    }

    const context = await resourceContext(ctx.deps, input.resource_id);
    const header = [`Querying resource: ${context.resourceTitle}`, `Resource ID: ${input.resource_id}`];
    if (context.datasetId) header.push(`Dataset: ${context.datasetTitle} (ID: ${context.datasetId})`);
    header.push("");
    const filters: TabularFilter[] = [];
    const sort: TabularSort[] = [];
    if (hasFilter && input.filter_column && input.filter_value !== undefined) {
      filters.push({
        column: input.filter_column,
        operator: operator as TabularOperator,
        value: input.filter_value,
      });
      header.push(`Filter: ${input.filter_column} ${operator} ${input.filter_value}`);
    }
    if (input.sort_column) {
      sort.push({ column: input.sort_column, direction: direction as "asc" | "desc" });
      header.push(`Sort: ${input.sort_column} (${direction})`);
    }
    if (filters.length > 0 || sort.length > 0) header.push("");

    let page: Awaited<ReturnType<ToolDeps["tabular"]["queryData"]>>;
    try {
      page = await ctx.deps.tabular.queryData(input.resource_id, {
        page: input.page,
        pageSize: input.page_size,
        filters,
        sort,
      });
    } catch (error) {
      throw mapTabularError(error, input.resource_id);
    }

    const columns = page.rows[0] ? Object.keys(page.rows[0]) : [];
    const totalPages = page.pageSize > 0 ? Math.ceil(page.total / page.pageSize) : undefined;
    const hasNext = page.nextUrl !== undefined || page.page * page.pageSize < page.total;
    const body: string[] = [];
    if (page.rows.length === 0) {
      body.push("⚠️  No rows available (resource may be empty or filtered).");
    } else {
      body.push(`Total rows (Tabular API): ${page.total}`);
      if (totalPages !== undefined) body.push(`Total pages: ${totalPages} (page size: ${page.pageSize})`);
      body.push(`Retrieved: ${page.rows.length} row(s) from page ${page.page}`);
      body.push(`Columns: ${columns.join(", ")}`, "");
      body.push(...renderRowsLegacy(page.rows));
      if (hasNext) {
        body.push("");
        body.push(
          page.total > LARGE_DATASET_ROWS
            ? `⚠️ Large dataset (${page.total} rows). To get all data, paginate using page=${page.page + 1} or use get_resource_info to retrieve the raw file URL and fetch it directly.`
            : `📄 More data available. Use page=${page.page + 1} to see the next page.`,
        );
      }
    }

    return {
      text: [...header, ...body].join("\n"),
      structured: {
        resource_id: input.resource_id,
        resource_title: context.resourceTitle,
        dataset_id: context.datasetId,
        dataset_title: context.datasetId ? context.datasetTitle : undefined,
        filter: filters[0]
          ? { column: filters[0].column, operator: filters[0].operator, value: filters[0].value }
          : undefined,
        sort: sort[0] ? { column: sort[0].column, direction: sort[0].direction } : undefined,
        total_pages: totalPages,
        columns,
        rows: page.rows,
        total: page.total,
        page: page.page,
        page_size: page.pageSize,
        has_next: hasNext,
        truncated: false,
      },
      howToGetMore: hasNext ? `Use page=${page.page + 1} for the next rows.` : undefined,
    };
  },
});

/** Best-effort context (legacy: failures fall back to "Unknown", never fail the query). */
async function resourceContext(deps: ToolDeps, resourceId: string) {
  let resourceTitle = "Unknown";
  let datasetId: string | undefined;
  let datasetTitle = "Unknown";
  try {
    const resource = await deps.datagouv.getResource(resourceId);
    resourceTitle = resource.title || "Unknown";
    datasetId = resource.datasetId || undefined;
  } catch {
    // ignore: context only
  }
  if (datasetId) {
    try {
      datasetTitle = (await deps.datagouv.getDataset(datasetId)).title || "Unknown";
    } catch {
      // ignore: context only
    }
  }
  return { resourceTitle, datasetId, datasetTitle };
}
