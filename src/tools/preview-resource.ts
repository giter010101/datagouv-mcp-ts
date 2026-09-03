import { z } from "zod";
import { truncate } from "../core/text.js";
import type { PreviewResult } from "../formats/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { recommendationFor } from "./shared/capability-hints.js";
import { cellText, humanSize, MAX_ROWS_PER_CALL, renderTable } from "./shared/formatters.js";
import { tableSliceShape } from "./shared/output-schemas.js";
import { openResource, requireAccessor } from "./shared/resource-access.js";
import { mapTabularError } from "./shared/tabular-errors.js";
import { defineTool } from "./types.js";

export const PREVIEW_DEFAULT_LIMIT = 20;
const TEXT_PREVIEW_CHARS = 8_000;
const MAX_ENTRIES_SHOWN = 100;

export const previewResourceInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_ROWS_PER_CALL)
    .default(PREVIEW_DEFAULT_LIMIT)
    .describe(
      "Max rows / features / archive entries to return (default 20, max 200). For documents: characters ÷ 40.",
    ),
  member: z
    .string()
    .optional()
    .describe(
      "Sub-table inside a container: XLSX sheet name, GPKG layer, or ZIP member. Omit to use the first / the listing.",
    ),
};

export const previewResourceOutputShape = {
  resource_id: z.string(),
  title: z.string(),
  capability: z.string(),
  accessor: z.string(),
  kind: z.enum(["table", "features", "text", "entries", "metadata"]),
  table: z.object(tableSliceShape).optional(),
  features: z.array(z.record(z.string(), z.unknown())).optional(),
  text: z.string().optional(),
  entries: z
    .array(
      z.object({
        name: z.string(),
        size_bytes: z.number().optional(),
        kind: z.string().optional(),
      }),
    )
    .optional(),
  facts: z.record(z.string(), z.unknown()),
  notes: z.array(z.string()),
  next_tool: z.string(),
};

export const previewResourceTool = defineTool<typeof previewResourceInputShape, ToolDeps>({
  name: "preview_resource",
  title: "Preview resource",
  description: [
    "Safely look inside any resource, whatever its format, with hard size caps.",
    "",
    "Routes by detected capability: first rows of a table (Tabular API, CSV/TSV, XLSX/ODS sheets,",
    "JSON/JSONL, Parquet), feature count + bounding box + sample features for GeoJSON, entry",
    "listing for archives (ZIP, Shapefile, GPKG), a text excerpt for documents (PDF/TXT/MD),",
    "and metadata only for API endpoints or unknown binaries. Downloads are bounded",
    "(MAX_DOWNLOAD_BYTES) and nothing is extracted from archives.",
    "Use `member` to pick a sheet / layer / archive member. Then use query_resource for filters",
    "and get_resource_schema for exact column types.",
  ].join("\n"),
  inputSchema: previewResourceInputShape,
  outputSchema: previewResourceOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const opened = await openResource(ctx.deps, input.resource_id, { signal: ctx.signal });
    const accessor = requireAccessor(opened, "preview");
    let preview: PreviewResult;
    try {
      preview = await accessor.preview(opened.ctx, { limit: input.limit, member: input.member });
    } catch (error) {
      throw opened.report.primary.startsWith("tabular_api")
        ? mapTabularError(error, input.resource_id)
        : error;
    }
    const rec = recommendationFor(opened.report.primary);
    const header = [
      `Preview of resource: ${opened.resource.title || "Untitled"}`,
      `Resource ID: ${opened.resource.id}`,
      `Access: ${opened.report.primary} via ${accessor.id}${input.member ? ` (member: ${input.member})` : ""}`,
      "",
    ];
    const body = renderPreview(preview);
    const facts = Object.entries(preview.facts).map(([k, v]) => `  ${k}: ${cellText(v)}`);
    const tail = [
      ...(facts.length > 0 ? ["", "Facts:", ...facts] : []),
      ...preview.notes.map((n) => `Note: ${n}`),
      ...opened.report.warnings.map((w) => `Warning: ${w}`),
      "",
      `Next: ${rec.tool}${rec.tool === "preview_resource" ? " with a different member or limit, or get_resource_schema" : ""}.`,
    ];
    const table = preview.table;
    return {
      text: [...header, ...body, ...tail].join("\n"),
      structured: {
        resource_id: opened.resource.id,
        title: opened.resource.title,
        capability: opened.report.primary,
        accessor: accessor.id,
        kind: preview.kind,
        table: table
          ? {
              columns: table.columns,
              rows: table.rows,
              total: table.total,
              page: table.page,
              page_size: table.pageSize,
              has_next: table.hasNext,
              truncated: table.truncated,
            }
          : undefined,
        features: preview.features,
        text: preview.text ? truncate(preview.text, TEXT_PREVIEW_CHARS) : undefined,
        entries: preview.entries?.slice(0, MAX_ENTRIES_SHOWN).map((e) => ({
          name: e.name,
          size_bytes: e.sizeBytes,
          kind: e.kind,
        })),
        facts: preview.facts,
        notes: preview.notes,
        next_tool: rec.tool,
      },
      howToGetMore:
        preview.kind === "table"
          ? "Use query_resource with page/page_size for more rows."
          : undefined,
    };
  },
});

export function renderPreview(preview: PreviewResult): string[] {
  switch (preview.kind) {
    case "table": {
      if (!preview.table) return ["(no table data)"];
      const t = preview.table;
      const out = [
        `Columns (${t.columns.length}): ${t.columns.join(", ")}`,
        `Rows shown: ${t.rows.length}${t.total !== undefined ? ` of ${t.total}` : ""}${t.truncated ? " (truncated)" : ""}`,
        "",
        ...renderTable(t),
      ];
      return out;
    }
    case "features": {
      const features = preview.features ?? [];
      const out = [`Sample features: ${features.length}`];
      features.forEach((f, i) => {
        out.push(`  ${i + 1}. ${truncate(JSON.stringify(f), 300)}`);
      });
      return out;
    }
    case "text":
      return ["Excerpt:", truncate(preview.text ?? "", TEXT_PREVIEW_CHARS)];
    case "entries": {
      const entries = preview.entries ?? [];
      const out = [`Entries (${entries.length}):`];
      for (const e of entries.slice(0, MAX_ENTRIES_SHOWN)) {
        out.push(
          `  - ${e.name}${e.sizeBytes !== undefined ? ` (${humanSize(e.sizeBytes)})` : ""}${e.kind ? ` [${e.kind}]` : ""}`,
        );
      }
      if (entries.length > MAX_ENTRIES_SHOWN)
        out.push(`  … ${entries.length - MAX_ENTRIES_SHOWN} more`);
      return out;
    }
    default:
      return ["No content preview is possible for this resource; see facts and the download URL."];
  }
}
