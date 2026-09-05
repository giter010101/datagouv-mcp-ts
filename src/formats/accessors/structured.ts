import type { FormatsDeps, ResourceAccessor } from "../types.js";
import {
  createFileTableAccessor,
  DEFAULT_PREVIEW_LIMIT,
  loadParsedTable,
  tablePreview,
} from "./shared.js";

export function createSpreadsheetAccessor(deps: FormatsDeps): ResourceAccessor {
  const base = createFileTableAccessor(deps, {
    id: "spreadsheet",
    capabilities: ["stream_parse"],
    formats: new Set(["xlsx", "xls", "ods"]),
    strategies: new Set(["spreadsheet"]),
    engineFormat: (detected) => (detected === "xls" || detected === "ods" ? detected : "xlsx"),
  });
  return {
    ...base,
    async preview(ctx, options) {
      const format =
        ctx.report.detectedFormat === "xls" || ctx.report.detectedFormat === "ods"
          ? ctx.report.detectedFormat
          : "xlsx";
      const table = await loadParsedTable(deps, ctx, {
        format,
        overflow: "truncate",
        limit: options?.limit ?? DEFAULT_PREVIEW_LIMIT,
        member: options?.member ?? ctx.member,
      });
      const sheets = table.facts.sheets;
      const notes: string[] = [];
      if (Array.isArray(sheets) && sheets.length > 1) {
        notes.push(
          `Workbook has ${sheets.length} sheets (${sheets.join(", ")}). Pass member=<sheet name> to preview another.`,
        );
      }
      return tablePreview(table, notes);
    },
  };
}

export function createJsonAccessor(deps: FormatsDeps): ResourceAccessor {
  return createFileTableAccessor(deps, {
    id: "json",
    capabilities: ["stream_parse"],
    formats: new Set(["json", "jsonl"]),
    strategies: new Set(["json"]),
    engineFormat: (detected) => (detected === "jsonl" ? "jsonl" : "json"),
  });
}

export function createXmlAccessor(deps: FormatsDeps): ResourceAccessor {
  return createFileTableAccessor(deps, {
    id: "xml",
    capabilities: ["stream_parse"],
    formats: new Set(["xml", "kml", "gpx", "gml"]),
    strategies: new Set(["xml"]),
    engineFormat: () => "xml",
  });
}
