import { ValidationError } from "../../core/errors.js";

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|attach|detach|copy|export|import|install|load|pragma|set|call|grant|truncate|replace|merge|vacuum|checkpoint)\b/i;

const FORBIDDEN_FUNCTIONS =
  /\b(read_csv|read_parquet|read_json|read_text|read_blob|glob|getenv)\s*\(/i;

/**
 * Accept only a single read-only `SELECT`/`WITH` statement that reads from the
 * `data` view exposed by the engine. Everything else is rejected before it
 * reaches DuckDB (defence in depth: the engine also runs read-only).
 */
export function assertReadOnlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (trimmed === "") throw new ValidationError("sql must not be empty.");
  if (trimmed.includes(";")) {
    throw new ValidationError("sql must be a single statement (no ';' separators).", {
      hint: "Send one SELECT at a time.",
    });
  }
  if (!/^\s*(select|with)\b/i.test(trimmed)) {
    throw new ValidationError("sql must start with SELECT or WITH (read-only).", {
      hint: "Example: SELECT col, COUNT(*) AS n FROM data GROUP BY col ORDER BY n DESC LIMIT 20",
    });
  }
  const stripped = trimmed.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
  const keyword = stripped.match(FORBIDDEN_KEYWORDS);
  if (keyword) {
    throw new ValidationError(`sql contains a forbidden keyword: ${keyword[0].toUpperCase()}.`, {
      hint: "Only read-only SELECT queries over the `data` table are allowed.",
    });
  }
  const fn = stripped.match(FORBIDDEN_FUNCTIONS);
  if (fn) {
    throw new ValidationError(
      `sql may not call ${fn[0].trim().replace(/\($/, "")}(): the resource is already exposed as the \`data\` table.`,
      {
        hint: "Write `FROM data` instead of reading files or URLs directly.",
      },
    );
  }
  return trimmed;
}
