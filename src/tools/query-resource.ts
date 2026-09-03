import { z } from "zod";
import type { TabularFilter, TabularSort } from "../clients/types.js";
import { EngineUnavailableError, UnsupportedCapabilityError } from "../core/errors.js";
import type { TableSlice } from "../core/types.js";
import type { QueryEngine, QuerySpec } from "../formats/types.js";
import type { ToolDeps } from "./deps.js";
import { TABULAR_OPERATORS } from "./query-resource-data.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { MAX_ROWS_PER_CALL, renderTable } from "./shared/formatters.js";
import { tableSliceShape } from "./shared/output-schemas.js";
import { type OpenedResource, openResource, requireAccessor } from "./shared/resource-access.js";
import { assertReadOnlySelect } from "./shared/sql-guard.js";
import { mapTabularError } from "./shared/tabular-errors.js";
import { defineTool } from "./types.js";

const ENGINE_FORMATS = new Set(["csv", "tsv", "parquet", "json", "jsonl", "xlsx"]);
const AGG_FUNCTIONS = ["count", "sum", "avg", "min", "max"] as const;

const filterSchema = z.object({
  column: z.string().min(1).describe("Exact column name (see get_resource_schema)."),
  operator: z
    .enum(TABULAR_OPERATORS as [string, ...string[]])
    .default("exact")
    .describe("exact | differs | contains | in (comma-separated values) | less | greater (inclusive) | strictly_less | strictly_greater."),
  value: z.string().describe("Comparison value as text (numbers/dates as written in the data)."),
});

const sortSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const aggregationSchema = z.object({
  function: z.enum(AGG_FUNCTIONS),
  column: z.string().optional().describe("Column to aggregate (omit for count)."),
});

export const queryResourceInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID."),
  filters: z.array(filterSchema).max(10).optional().describe("Filters, ANDed together."),
  sort: z.array(sortSchema).max(3).optional().describe("Sort keys, in priority order."),
  columns: z.array(z.string()).max(50).optional().describe("Only return these columns."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(MAX_ROWS_PER_CALL)
    .default(20)
    .describe("Rows per page (1–200)."),
  group_by: z
    .array(z.string())
    .max(5)
    .optional()
    .describe("Aggregate rows by these columns (requires the SQL engine, ENABLE_DUCKDB=1). Combine with `aggregations`."),
  aggregations: z
    .array(aggregationSchema)
    .max(10)
    .optional()
    .describe("Aggregations to compute per group (count/sum/avg/min/max). Requires the SQL engine."),
  sql: z
    .string()
    .optional()
    .describe(
      "Advanced: a single read-only SELECT over the table named `data` (e.g. SELECT dep, COUNT(*) n FROM data GROUP BY dep ORDER BY n DESC LIMIT 10). Requires ENABLE_DUCKDB=1; ignored filters/sort/page when set.",
    ),
};

export const queryResourceOutputShape = {
  resource_id: z.string(),
  title: z.string(),
  capability: z.string(),
  engine: z.string().describe("Accessor or engine that produced the rows."),
  mode: z.enum(["filters", "sql", "aggregation"]),
  sql: z.string().optional(),
  ...tableSliceShape,
};

export const queryResourceTool = defineTool<typeof queryResourceInputShape, ToolDeps>({
  name: "query_resource",
  title: "Query resource",
  description: [
    "Query the rows of any tabular resource with filters, sort and pagination, whatever the format.",
    "",
    "Routes automatically by detected capability: Tabular API (CSV/XLSX indexed by data.gouv.fr),",
    "Parquet (native or converted), or a bounded in-process parse of CSV/TSV/XLSX/ODS/JSON/JSONL.",
    "Same filter vocabulary as query_resource_data (exact, differs, contains, in, less, greater,",
    "strictly_less, strictly_greater) but several filters and sort keys are allowed and columns can",
    "be projected. Max 200 rows per call; paginate with `page`.",
    "",
    "Aggregations (`group_by` + `aggregations`) and raw `sql` (single read-only SELECT over `data`)",
    "need the optional DuckDB engine (ENABLE_DUCKDB=1); otherwise an ENGINE_UNAVAILABLE error tells",
    "you to fall back to filters. Call get_resource_schema first for exact column names.",
    "Not for documents/archives/APIs: use preview_resource there.",
  ].join("\n"),
  inputSchema: queryResourceInputShape,
  outputSchema: queryResourceOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const opened = await openResource(ctx.deps, input.resource_id, { signal: ctx.signal });
    const wantsSql = input.sql !== undefined;
    const wantsAggregation = (input.group_by?.length ?? 0) > 0 || (input.aggregations?.length ?? 0) > 0;

    let slice: TableSlice;
    let engineId: string;
    let mode: "filters" | "sql" | "aggregation" = "filters";
    let sql: string | undefined;

    if (wantsSql || wantsAggregation) {
      mode = wantsSql ? "sql" : "aggregation";
      sql = wantsSql && input.sql ? assertReadOnlySelect(input.sql) : buildAggregationSql(input);
      const engine = await requireEngine(ctx.deps, opened);
      const { url, format } = engineTarget(opened);
      slice = await engine.queryUrl(url, format, { sql, pageSize: input.page_size }, ctx.signal);
      engineId = engine.id;
    } else {
      const accessor = requireAccessor(opened, "query");
      const spec: QuerySpec = {
        filters: input.filters?.map(
          (f): TabularFilter => ({ column: f.column, operator: f.operator as TabularFilter["operator"], value: f.value }),
        ),
        sort: input.sort?.map((s): TabularSort => ({ column: s.column, direction: s.direction })),
        columns: input.columns,
        page: input.page,
        pageSize: input.page_size,
      };
      const query = accessor.query?.bind(accessor);
      if (!query) throw new UnsupportedCapabilityError(`Accessor ${accessor.id} cannot query.`);
      try {
        slice = await query(opened.ctx, spec);
      } catch (error) {
        throw opened.report.primary.startsWith("tabular_api")
          ? mapTabularError(error, input.resource_id)
          : error;
      }
      engineId = accessor.id;
    }

    const header = [
      `Query on resource: ${opened.resource.title || "Untitled"}`,
      `Resource ID: ${opened.resource.id}`,
      `Access: ${opened.report.primary} via ${engineId} (mode: ${mode})`,
    ];
    if (sql) header.push(`SQL: ${sql}`);
    if (input.filters?.length) {
      header.push(`Filters: ${input.filters.map((f) => `${f.column} ${f.operator} ${f.value}`).join(" AND ")}`);
    }
    if (input.sort?.length) {
      header.push(`Sort: ${input.sort.map((s) => `${s.column} ${s.direction}`).join(", ")}`);
    }
    header.push("");
    const summary = [
      `Rows: ${slice.rows.length}${slice.total !== undefined ? ` of ${slice.total}` : ""}${
        slice.page !== undefined ? ` (page ${slice.page})` : ""
      }${slice.truncated ? " — truncated by size budget" : ""}`,
      "",
      ...renderTable(slice),
    ];
    if (slice.hasNext && slice.page !== undefined) {
      summary.push("", `More rows available: use page=${slice.page + 1}.`);
    }
    for (const w of opened.report.warnings) summary.push(`Warning: ${w}`);

    return {
      text: [...header, ...summary].join("\n"),
      structured: {
        resource_id: opened.resource.id,
        title: opened.resource.title,
        capability: opened.report.primary,
        engine: engineId,
        mode,
        sql,
        columns: slice.columns,
        rows: slice.rows,
        total: slice.total,
        page: slice.page,
        page_size: slice.pageSize,
        has_next: slice.hasNext,
        truncated: slice.truncated,
      },
      howToGetMore:
        slice.hasNext && slice.page !== undefined
          ? `Use page=${slice.page + 1} for the next rows, or add filters.`
          : "Add filters or project fewer columns.",
    };
  },
});

async function requireEngine(deps: ToolDeps, opened: OpenedResource): Promise<QueryEngine> {
  const engine = deps.formats.engine;
  if (!deps.config.engines.duckdb || !engine || !(await engine.isAvailable())) {
    throw new EngineUnavailableError(
      "SQL and aggregations require the optional DuckDB engine, which is not enabled on this server.",
      {
        details: { resource_id: opened.resource.id, enable: "ENABLE_DUCKDB=1" },
        hint: "Use `filters`, `sort`, `columns` and pagination instead (query_resource without sql/group_by), or ask the operator to enable ENABLE_DUCKDB.",
      },
    );
  }
  return engine;
}

function engineTarget(opened: OpenedResource): { url: string; format: string } {
  const { report } = opened;
  if (report.urls.parquet) return { url: report.urls.parquet, format: "parquet" };
  const format = report.detectedFormat.toLowerCase();
  if (!ENGINE_FORMATS.has(format)) {
    throw new UnsupportedCapabilityError(
      `The SQL engine cannot read format '${format || "unknown"}' (resource ${opened.resource.id}).`,
      {
        details: { resource_id: opened.resource.id, format },
        hint: "Use query_resource with filters (no sql) or preview_resource.",
      },
    );
  }
  return { url: report.urls.latest, format };
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_ .\-éèàùçÉÈÀÙÇ()%/']*$/u;

function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new UnsupportedCapabilityError(`Unsupported column name for aggregation: '${name}'.`, {
      hint: "Use exact column names from get_resource_schema.",
    });
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** Translate group_by/aggregations into a guarded SELECT over `data`. */
export function buildAggregationSql(input: {
  group_by?: string[];
  aggregations?: Array<{ function: (typeof AGG_FUNCTIONS)[number]; column?: string }>;
  filters?: Array<{ column: string; operator: string; value: string }>;
  sort?: Array<{ column: string; direction: "asc" | "desc" }>;
  page_size: number;
  page: number;
}): string {
  const groups = (input.group_by ?? []).map(quoteIdent);
  const aggs = (input.aggregations ?? []).map((a) => {
    const alias = a.column ? `${a.function}_${a.column.replace(/[^A-Za-z0-9_]/g, "_")}` : "count";
    if (a.function === "count" && !a.column) return `COUNT(*) AS "${alias}"`;
    if (!a.column) {
      throw new UnsupportedCapabilityError(`Aggregation ${a.function} requires a column.`);
    }
    return `${a.function.toUpperCase()}(${quoteIdent(a.column)}) AS "${alias}"`;
  });
  if (aggs.length === 0) aggs.push('COUNT(*) AS "count"');
  const select = [...groups, ...aggs].join(", ");
  const where = (input.filters ?? []).map((f) => {
    const col = quoteIdent(f.column);
    const lit = `'${f.value.replace(/'/g, "''")}'`;
    switch (f.operator) {
      case "differs":
        return `CAST(${col} AS VARCHAR) <> ${lit}`;
      case "contains":
        return `CAST(${col} AS VARCHAR) ILIKE '%' || ${lit} || '%'`;
      case "in":
        return `CAST(${col} AS VARCHAR) IN (${f.value
          .split(",")
          .map((v) => `'${v.trim().replace(/'/g, "''")}'`)
          .join(", ")})`;
      case "less":
        return `${col} <= ${lit}`;
      case "greater":
        return `${col} >= ${lit}`;
      case "strictly_less":
        return `${col} < ${lit}`;
      case "strictly_greater":
        return `${col} > ${lit}`;
      default:
        return `CAST(${col} AS VARCHAR) = ${lit}`;
    }
  });
  const orderBy = (input.sort ?? []).map((s) => `${quoteIdent(s.column)} ${s.direction.toUpperCase()}`);
  const offset = (input.page - 1) * input.page_size;
  return [
    `SELECT ${select} FROM data`,
    where.length > 0 ? `WHERE ${where.join(" AND ")}` : undefined,
    groups.length > 0 ? `GROUP BY ${groups.join(", ")}` : undefined,
    orderBy.length > 0 ? `ORDER BY ${orderBy.join(", ")}` : undefined,
    `LIMIT ${input.page_size}${offset > 0 ? ` OFFSET ${offset}` : ""}`,
  ]
    .filter((p): p is string => p !== undefined)
    .join(" ");
}
