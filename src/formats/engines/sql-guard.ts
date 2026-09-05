import { ValidationError } from "../../core/errors.js";

/**
 * Read-only SQL allow-list for the DuckDB engine. The LLM may send a single
 * `SELECT`/`WITH` statement over the virtual table `data`; everything else is
 * rejected before it reaches the engine. Defence in depth: the engine also runs
 * with `enable_external_access = false` after loading the file.
 */

const FORBIDDEN = [
  "attach",
  "detach",
  "copy",
  "export",
  "import",
  "install",
  "load",
  "pragma",
  "set",
  "reset",
  "create",
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "call",
  "vacuum",
  "checkpoint",
  "begin",
  "commit",
  "rollback",
  "grant",
  "revoke",
  "use",
  "force",
  "read_csv",
  "read_csv_auto",
  "read_parquet",
  "read_json",
  "read_json_auto",
  "read_text",
  "read_blob",
  "glob",
  "getenv",
  "http_get",
  "sqlite_scan",
  "postgres_scan",
  "iceberg_scan",
  "delta_scan",
  "duckdb_secrets",
  "current_setting",
  "system",
  "shellfs",
];

export const DEFAULT_SQL_LIMIT = 200;
export const MAX_SQL_LIMIT = 1000;

/** Strip string literals and comments so keyword checks are not fooled. */
export function stripLiteralsAndComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i] ?? "";
    const next = sql[i + 1] ?? "";
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out += ch === "'" ? "''" : '""';
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export interface GuardedSql {
  /** Statement with trailing semicolon removed. */
  sql: string;
  /** Final wrapped statement with an enforced LIMIT/OFFSET. */
  wrapped: string;
  limit: number;
  offset: number;
}

export function guardReadOnlySql(
  input: string,
  options: { limit?: number; offset?: number } = {},
): GuardedSql {
  const raw = input.trim().replace(/;\s*$/, "");
  if (raw === "") throw new ValidationError("SQL statement is empty");
  const stripped = stripLiteralsAndComments(raw);
  if (stripped.includes(";")) {
    throw new ValidationError("Only a single SQL statement is allowed", {
      hint: "Remove additional statements; only one SELECT is executed.",
    });
  }
  const firstWord = /^\s*(\w+)/.exec(stripped)?.[1]?.toLowerCase();
  if (firstWord !== "select" && firstWord !== "with") {
    throw new ValidationError("Only read-only SELECT / WITH statements are allowed", {
      hint: 'Start the statement with SELECT (the file is exposed as table "data").',
    });
  }
  const words = stripped.toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? [];
  const hit = words.find((w) => FORBIDDEN.includes(w));
  if (hit) {
    throw new ValidationError(`Forbidden SQL keyword or function: ${hit}`, {
      hint: 'Query the virtual table "data" with plain SELECT; no DDL, COPY, ATTACH, INSTALL, file or network functions.',
    });
  }
  const limit = Math.min(
    MAX_SQL_LIMIT,
    Math.max(1, Math.floor(options.limit ?? DEFAULT_SQL_LIMIT)),
  );
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  return {
    sql: raw,
    wrapped: `SELECT * FROM (${raw}) AS __q LIMIT ${limit} OFFSET ${offset}`,
    limit,
    offset,
  };
}
