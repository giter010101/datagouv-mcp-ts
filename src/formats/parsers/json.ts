import { FormatError } from "../../core/errors.js";
import type { Row } from "../../core/types.js";

/**
 * JSON / JSON Lines → records. Handles a top-level array, an object wrapping
 * an array (`{ "results": [...] }`, `{ "data": { "items": [...] } }`), a single
 * object (one row) and NDJSON. Nested objects are flattened with dot notation
 * (bounded depth); arrays of scalars/objects are kept as JSON values.
 */

export interface JsonRecords {
  rows: Row[];
  /** JSON path of the records array (`$`, `$.results`, …) or `$` for a single object. */
  recordsPath: string;
  /** Number of records available in the document (before `limit`). */
  total: number;
  /** Top-level keys when the document is an object (context for the LLM). */
  topLevelKeys: string[] | undefined;
  truncated: boolean;
  kind: "array" | "object-with-array" | "object" | "jsonl" | "scalar";
}

export const FLATTEN_DEPTH = 2;

export function flattenRecord(value: unknown, depth = FLATTEN_DEPTH, prefix = ""): Row {
  const row: Row = {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    row[prefix || "value"] = value;
    return row;
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && depth > 0 && !isGeometry(v)) {
      Object.assign(row, flattenRecord(v, depth - 1, name));
    } else {
      row[name] = v;
    }
  }
  return row;
}

function isGeometry(value: object): boolean {
  const rec = value as Record<string, unknown>;
  return typeof rec.type === "string" && ("coordinates" in rec || "geometries" in rec);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.slice(0, 20).every((v) => v !== null && typeof v === "object" && !Array.isArray(v))
  );
}

/** Find the largest array of objects within `depth` levels of the root. */
export function findRecordsArray(
  value: unknown,
  depth = 3,
  path = "$",
): { array: unknown[]; path: string } | undefined {
  if (Array.isArray(value)) return { array: value, path };
  if (value === null || typeof value !== "object" || depth === 0) return undefined;
  let best: { array: unknown[]; path: string } | undefined;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (isRecordArray(v) && (!best || v.length > best.array.length)) {
      best = { array: v, path: childPath };
    } else if (!Array.isArray(v) && v !== null && typeof v === "object") {
      const nested = findRecordsArray(v, depth - 1, childPath);
      if (
        nested &&
        isRecordArray(nested.array) &&
        (!best || nested.array.length > best.array.length)
      ) {
        best = nested;
      }
    }
  }
  return best;
}

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new FormatError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error, hint: "The file may be truncated, JSON Lines, or not JSON at all." },
    );
  }
}

export function recordsFromJson(doc: unknown, limit?: number): JsonRecords {
  if (Array.isArray(doc)) {
    const rows = doc.slice(0, limit).map((item) => flattenRecord(item));
    return {
      rows,
      recordsPath: "$",
      total: doc.length,
      topLevelKeys: undefined,
      truncated: limit !== undefined && doc.length > limit,
      kind: "array",
    };
  }
  if (doc !== null && typeof doc === "object") {
    const keys = Object.keys(doc as Record<string, unknown>);
    const found = findRecordsArray(doc);
    if (found && found.path !== "$") {
      const rows = found.array.slice(0, limit).map((item) => flattenRecord(item));
      return {
        rows,
        recordsPath: found.path,
        total: found.array.length,
        topLevelKeys: keys,
        truncated: limit !== undefined && found.array.length > limit,
        kind: "object-with-array",
      };
    }
    return {
      rows: [flattenRecord(doc)],
      recordsPath: "$",
      total: 1,
      topLevelKeys: keys,
      truncated: false,
      kind: "object",
    };
  }
  return {
    rows: [{ value: doc }],
    recordsPath: "$",
    total: 1,
    topLevelKeys: undefined,
    truncated: false,
    kind: "scalar",
  };
}

export function parseJsonl(
  text: string,
  options: { limit?: number; inputTruncated?: boolean } = {},
): JsonRecords {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (options.inputTruncated && lines.length > 0) lines.pop();
  const rows: Row[] = [];
  let invalid = 0;
  const selected = options.limit !== undefined ? lines.slice(0, options.limit) : lines;
  for (const line of selected) {
    try {
      rows.push(flattenRecord(JSON.parse(line)));
    } catch {
      invalid++;
    }
  }
  if (rows.length === 0 && lines.length > 0) {
    throw new FormatError("No valid JSON object found in the JSON Lines file", {
      details: { invalidLines: invalid },
    });
  }
  return {
    rows,
    recordsPath: "$[line]",
    total: lines.length,
    topLevelKeys: undefined,
    truncated: options.limit !== undefined && lines.length > options.limit,
    kind: "jsonl",
  };
}

export function looksLikeJsonl(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 3);
  return lines.length >= 2 && lines.every((l) => /^\s*\{.*\}\s*$/.test(l));
}
