import { formatBytes, truncate } from "../core/text.js";
import type { TableSchema, TableSlice } from "../core/types.js";
import type { CapabilityReport, PreviewResult } from "./types.js";

/**
 * Compact, deterministic text rendering of tables / previews / schemas for LLM
 * consumption (ADR 0008): bounded rows, columns and cell width.
 */

export interface TableTextOptions {
  maxRows?: number;
  maxCols?: number;
  maxCellChars?: number;
}

const DEFAULTS: Required<TableTextOptions> = { maxRows: 50, maxCols: 20, maxCellChars: 60 };

export function cellToText(value: unknown, maxChars: number): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    text = String(value);
  } else if (value instanceof Date) text = value.toISOString();
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "\\|");
  return truncate(text, maxChars, "…");
}

export function renderTable(slice: TableSlice, options: TableTextOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  const columns = slice.columns.slice(0, opts.maxCols);
  const hiddenCols = slice.columns.length - columns.length;
  const rows = slice.rows.slice(0, opts.maxRows);
  const lines: string[] = [];
  if (columns.length === 0) {
    lines.push("(no columns)");
  } else {
    lines.push(`| ${columns.map((c) => cellToText(c, opts.maxCellChars)).join(" | ")} |`);
    lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
    for (const row of rows) {
      lines.push(`| ${columns.map((c) => cellToText(row[c], opts.maxCellChars)).join(" | ")} |`);
    }
  }
  const notes: string[] = [];
  if (hiddenCols > 0) {
    notes.push(
      `${hiddenCols} more column(s) not shown: ${slice.columns
        .slice(columns.length, columns.length + 10)
        .join(", ")}${hiddenCols > 10 ? ", …" : ""}. Use the columns parameter to select them.`,
    );
  }
  if (slice.rows.length > rows.length) {
    notes.push(`${slice.rows.length - rows.length} more row(s) in this page not shown.`);
  }
  const totalText = slice.total !== undefined ? `${slice.total} total row(s)` : "total unknown";
  const pageText =
    slice.page !== undefined
      ? `page ${slice.page}${slice.pageSize !== undefined ? ` (page_size ${slice.pageSize})` : ""}`
      : "";
  notes.push(
    `Showing ${rows.length} row(s); ${totalText}${pageText ? `; ${pageText}` : ""}${
      slice.hasNext ? `; more available: use page=${(slice.page ?? 1) + 1}` : ""
    }${slice.truncated ? "; result truncated by size budget" : ""}.`,
  );
  return [...lines, "", ...notes].join("\n");
}

export function renderSchema(schema: TableSchema, maxColumns = 100): string {
  const lines: string[] = [];
  lines.push(
    `Columns (${schema.columns.length})${
      schema.rowCount !== undefined ? `, ${schema.rowCount} row(s)` : ""
    } — source: ${schema.source}`,
  );
  for (const col of schema.columns.slice(0, maxColumns)) {
    const parts = [`- ${col.name}: ${col.type}`];
    if (col.nativeType && col.nativeType !== col.type) parts.push(`(${col.nativeType})`);
    const stats = col.stats ?? {};
    const nullRatio = stats.nullRatio;
    if (typeof nullRatio === "number" && nullRatio > 0) {
      parts.push(`nulls ${Math.round(nullRatio * 100)}%`);
    }
    if (Array.isArray(stats.sampleValues) && stats.sampleValues.length > 0) {
      parts.push(`e.g. ${stats.sampleValues.map((v) => cellToText(v, 30)).join(", ")}`);
    }
    if (typeof stats.min === "number" && typeof stats.max === "number") {
      parts.push(`range ${stats.min}–${stats.max}`);
    }
    lines.push(parts.join(" "));
  }
  if (schema.columns.length > maxColumns) {
    lines.push(`… ${schema.columns.length - maxColumns} more column(s).`);
  }
  return lines.join("\n");
}

export function renderFacts(facts: Record<string, unknown>): string {
  return Object.entries(facts)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const text =
        k.toLowerCase().includes("bytes") && typeof v === "number"
          ? formatBytes(v)
          : cellToText(v, 200);
      return `${k}: ${text}`;
    })
    .join("\n");
}

export function renderPreview(result: PreviewResult, options: TableTextOptions = {}): string {
  const sections: string[] = [];
  switch (result.kind) {
    case "table":
      if (result.table) sections.push(renderTable(result.table, options));
      break;
    case "features":
      if (result.table) sections.push(renderTable(result.table, options));
      else if (result.features) {
        sections.push(
          result.features
            .slice(0, options.maxRows ?? DEFAULTS.maxRows)
            .map((f, i) => `${i + 1}. ${cellToText(f, 300)}`)
            .join("\n"),
        );
      }
      break;
    case "text":
      if (result.text !== undefined) sections.push(result.text);
      break;
    case "entries":
      if (result.entries) {
        sections.push(
          result.entries
            .slice(0, options.maxRows ?? 100)
            .map(
              (e) =>
                `- ${e.name}${e.sizeBytes !== undefined ? ` (${formatBytes(e.sizeBytes)})` : ""}${
                  e.kind ? ` [${e.kind}]` : ""
                }`,
            )
            .join("\n"),
        );
        if (result.entries.length > (options.maxRows ?? 100)) {
          sections.push(`… ${result.entries.length - (options.maxRows ?? 100)} more entries.`);
        }
      }
      break;
    default:
      break;
  }
  const facts = renderFacts(result.facts);
  if (facts) sections.push(facts);
  if (result.notes.length > 0) sections.push(result.notes.map((n) => `Note: ${n}`).join("\n"));
  return sections.filter((s) => s.trim() !== "").join("\n\n");
}

export function renderCapability(report: CapabilityReport): string {
  const lines = [
    `Access: ${report.primary} via ${report.strategy} (confidence ${report.confidence})`,
    `Format: ${report.detectedFormat || "unknown"} (${report.formatFamily})${
      report.compression ? `, ${report.compression}-compressed` : ""
    }${report.sizeBytes !== undefined ? `, ${formatBytes(report.sizeBytes)}` : ""}`,
  ];
  if (report.capabilities.length > 1)
    lines.push(`Fallbacks: ${report.capabilities.slice(1).join(", ")}`);
  if (report.urls.tabularApi) lines.push(`Tabular API: ${report.urls.tabularApi}`);
  if (report.urls.parquet) lines.push(`Parquet: ${report.urls.parquet}`);
  if (report.urls.geojson) lines.push(`GeoJSON: ${report.urls.geojson}`);
  lines.push(`Download: ${report.urls.latest}`);
  for (const w of report.warnings) lines.push(`Warning: ${w}`);
  return lines.join("\n");
}
