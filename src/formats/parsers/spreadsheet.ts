import * as XLSX from "xlsx";
import { FormatError, NotFoundError } from "../../core/errors.js";
import type { Row } from "../../core/types.js";

/**
 * XLSX / XLS / ODS via SheetJS (read-only). Multi-sheet listing, sheet
 * selection, header-row detection, bounded row reads (`sheetRows`).
 */

export interface SheetInfo {
  name: string;
  /** Approximate row count from the sheet range (includes header). */
  rows: number | undefined;
  columns: number | undefined;
}

export interface ParsedSheet {
  sheet: string;
  sheets: SheetInfo[];
  rows: Row[];
  columns: string[];
  /** 1-based index of the detected header row. */
  headerRow: number;
  truncated: boolean;
  totalDataRows: number | undefined;
}

type Cell = string | number | boolean | Date | null | undefined;

function readWorkbook(bytes: Uint8Array, sheetRows?: number): XLSX.WorkBook {
  try {
    return XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      dense: true,
      sheetRows: sheetRows !== undefined ? sheetRows : undefined,
      cellHTML: false,
      cellFormula: false,
      cellStyles: false,
    });
  } catch (error) {
    throw new FormatError(
      `Could not open the spreadsheet: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
        hint: "The file may be corrupt or not a spreadsheet; check the declared format.",
      },
    );
  }
}

function sheetInfos(workbook: XLSX.WorkBook): SheetInfo[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const ref = sheet?.["!ref"];
    if (!ref) return { name, rows: 0, columns: 0 };
    const range = XLSX.utils.decode_range(ref);
    return { name, rows: range.e.r - range.s.r + 1, columns: range.e.c - range.s.c + 1 };
  });
}

export function listSheets(bytes: Uint8Array): SheetInfo[] {
  // Only the first row of each sheet is decoded (`sheetRows: 1`), so listing stays cheap;
  // ranges come from the sheet dimension record, which SheetJS keeps.
  return sheetInfos(readWorkbook(bytes, 1));
}

/** Pick the first row that looks like a header: ≥ 2 non-empty cells, mostly text, densest among the first 15. */
export function detectHeaderRow(grid: Cell[][]): number {
  const window = grid.slice(0, 15);
  let bestIndex = 0;
  let bestScore = -1;
  window.forEach((row, index) => {
    const cells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (cells.length < 2) return;
    const textual = cells.filter((c) => typeof c === "string").length;
    const density = cells.length;
    const score = textual * 2 + density - index * 0.5;
    if (textual / cells.length >= 0.6 && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function headerNames(row: Cell[]): string[] {
  const seen = new Map<string, number>();
  return row.map((c, i) => {
    let name = c === null || c === undefined ? "" : String(c).trim();
    if (name === "") name = `column_${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return n > 0 ? `${name}_${n + 1}` : name;
  });
}

function cellValue(cell: XLSX.CellObject | undefined): Cell {
  if (!cell) return null;
  if (cell.t === "d" && cell.v instanceof Date) return cell.v.toISOString();
  if (cell.t === "e") return null;
  const v = cell.v;
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : null;
}

function sheetToGrid(sheet: XLSX.WorkSheet): Cell[][] {
  const dense = sheet as unknown as {
    "!data"?: Array<Array<XLSX.CellObject | undefined> | undefined>;
  };
  if (dense["!data"]) {
    return dense["!data"].map((row) => (row ?? []).map(cellValue));
  }
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid: Cell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellValue(sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined));
    }
    grid.push(row);
  }
  return grid;
}

export interface ParseSheetOptions {
  sheet?: string;
  /** Max data rows returned (rows are read up to header + limit + 15 for header detection). */
  limit?: number;
}

export function parseSheet(bytes: Uint8Array, options: ParseSheetOptions = {}): ParsedSheet {
  const rowsToRead = options.limit !== undefined ? options.limit + 16 : undefined;
  const workbook = readWorkbook(bytes, rowsToRead);
  const sheets = sheetInfos(readWorkbook(bytes, 1));
  const name = options.sheet ?? workbook.SheetNames[0];
  if (name === undefined) {
    throw new FormatError("The workbook contains no sheet");
  }
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new NotFoundError(`Sheet "${name}" not found`, {
      details: { sheets: workbook.SheetNames },
      hint: `Available sheets: ${workbook.SheetNames.join(", ")}`,
    });
  }
  const grid = sheetToGrid(sheet);
  const headerIndex = detectHeaderRow(grid);
  const columns = headerNames(grid[headerIndex] ?? []);
  let data = grid
    .slice(headerIndex + 1)
    .filter((row) => row.some((c) => c !== null && c !== undefined && String(c) !== ""));
  const info = sheets.find((s) => s.name === name);
  const totalDataRows =
    info?.rows !== undefined ? Math.max(0, info.rows - headerIndex - 1) : undefined;
  let truncated = false;
  if (options.limit !== undefined && data.length > options.limit) {
    data = data.slice(0, options.limit);
    truncated = true;
  } else if (
    totalDataRows !== undefined &&
    data.length < totalDataRows &&
    rowsToRead !== undefined
  ) {
    truncated = true;
  }
  const rows: Row[] = data.map((values) => {
    const row: Row = {};
    columns.forEach((col, i) => {
      row[col] = values[i] ?? null;
    });
    return row;
  });
  return {
    sheet: name,
    sheets,
    rows,
    columns,
    headerRow: headerIndex + 1,
    truncated,
    totalDataRows,
  };
}
