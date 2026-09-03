import { parse } from "csv-parse/sync";
import { FormatError } from "../../core/errors.js";
import type { Row } from "../../core/types.js";

/** CSV/TSV parsing with delimiter/quote/header sniffing (csv-parse, synchronous on bounded text). */

export interface CsvDialect {
  delimiter: string;
  quote: string;
  headerLine: string;
}

export interface ParsedCsv {
  rows: Row[];
  columns: string[];
  dialect: CsvDialect;
  /** True when `limit` stopped the parse before the end of the text. */
  truncated: boolean;
}

const CANDIDATES = [",", ";", "\t", "|"];

function countOutsideQuotes(line: string, delimiter: string, quote: string): number {
  let count = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === quote) inQuotes = !inQuotes;
    else if (ch === delimiter && !inQuotes) count++;
  }
  return count;
}

export function sniffCsvDialect(text: string, forcedDelimiter?: string): CsvDialect {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 20);
  const headerLine = lines[0] ?? "";
  const quote = headerLine.includes("'") && !headerLine.includes('"') ? "'" : '"';
  if (forcedDelimiter) return { delimiter: forcedDelimiter, quote, headerLine };
  let best = { delimiter: ",", score: -1 };
  for (const delimiter of CANDIDATES) {
    const counts = lines.map((l) => countOutsideQuotes(l, delimiter, quote));
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const consistent = counts.filter((c) => c === first).length;
    const score = consistent * 1000 + first;
    if (score > best.score) best = { delimiter, score };
  }
  return { delimiter: best.delimiter, quote, headerLine };
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = h.trim().replace(/^\uFEFF/, "") || `column_${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n > 0) name = `${name}_${n + 1}`;
    return name;
  });
}

export interface ParseCsvOptions {
  /** Max data rows returned. */
  limit?: number;
  delimiter?: string;
  /** Drop the last row when the input was cut mid-stream. */
  inputTruncated?: boolean;
}

export function parseCsv(text: string, options: ParseCsvOptions = {}): ParsedCsv {
  const dialect = sniffCsvDialect(text, options.delimiter);
  if (dialect.headerLine === "") {
    return { rows: [], columns: [], dialect, truncated: false };
  }
  let records: string[][];
  try {
    records = parse(text, {
      delimiter: dialect.delimiter,
      quote: dialect.quote,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: false,
      to: options.limit !== undefined ? options.limit + 1 : undefined,
    }) as string[][];
  } catch (error) {
    throw new FormatError(
      `Could not parse CSV: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error, hint: "The file may not be a CSV; check the declared format and the URL." },
    );
  }
  const headerRow = records[0] ?? [];
  const columns = uniqueHeaders(headerRow);
  let data = records.slice(1);
  const reachedLimit = options.limit !== undefined && data.length >= options.limit;
  if (options.inputTruncated && data.length > 0 && !reachedLimit) data = data.slice(0, -1);
  if (options.limit !== undefined) data = data.slice(0, options.limit);
  const rows: Row[] = data.map((values) => {
    const row: Row = {};
    columns.forEach((name, i) => {
      row[name] = values[i] ?? null;
    });
    return row;
  });
  return { rows, columns, dialect, truncated: reachedLimit };
}

/** Rough row-count estimate from a partial read: bytes / average row bytes. */
export function estimateRowCount(
  sampleBytes: number,
  sampleRows: number,
  totalBytes: number | undefined,
): number | undefined {
  if (totalBytes === undefined || sampleRows === 0 || sampleBytes === 0) return undefined;
  return Math.round((totalBytes / sampleBytes) * sampleRows);
}
