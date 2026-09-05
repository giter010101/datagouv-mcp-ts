import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_TOOLS } from "../src/tools/index.js";

/**
 * Gate: every `ALL_TOOLS` name has at least one row in `docs/evidence/coverage.md`.
 *
 *   pnpm evidence:check
 */

const COVERAGE_PATH = resolve("docs/evidence/coverage.md");
const ROW =
  /^\|\s*`(?<tool>[a-z0-9_]+)`\s*\|\s*`(?<file>[^`]+)`\s*\|\s*(?<mode>offline|live)\s*\|\s*(?<status>\S+)\s*\|/i;

interface CoverageRow {
  tool: string;
  file: string;
  mode: string;
  status: string;
}

function parseCoverage(markdown: string): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const line of markdown.split("\n")) {
    const match = ROW.exec(line);
    const tool = match?.groups?.tool;
    const file = match?.groups?.file;
    const mode = match?.groups?.mode;
    const status = match?.groups?.status;
    if (!tool || !file || !mode || !status) continue;
    rows.push({
      tool,
      file,
      mode: mode.toLowerCase(),
      status,
    });
  }
  return rows;
}

if (!existsSync(COVERAGE_PATH)) {
  console.error(`Missing ${COVERAGE_PATH}`);
  process.exit(1);
}

const markdown = readFileSync(COVERAGE_PATH, "utf8");
const rows = parseCoverage(markdown);
const byTool = new Map<string, CoverageRow[]>();
for (const row of rows) {
  const list = byTool.get(row.tool) ?? [];
  list.push(row);
  byTool.set(row.tool, list);
}

const registered = ALL_TOOLS.map((t) => t.name);
const missing: string[] = [];
const brokenFiles: string[] = [];
const failing: string[] = [];

for (const name of registered) {
  const evidence = byTool.get(name) ?? [];
  if (evidence.length === 0) {
    missing.push(name);
    continue;
  }
  for (const row of evidence) {
    const path = resolve("docs/evidence", row.file);
    if (!existsSync(path)) brokenFiles.push(`${name} → ${row.file}`);
    if (!/^(PASS|OK)$/i.test(row.status)) failing.push(`${name} (${row.file}: ${row.status})`);
  }
}

if (missing.length || brokenFiles.length || failing.length) {
  if (missing.length) {
    console.error("Tools without a coverage.md row:");
    for (const name of missing) console.error(`  - ${name}`);
  }
  if (brokenFiles.length) {
    console.error("Coverage rows pointing at missing evidence files:");
    for (const line of brokenFiles) console.error(`  - ${line}`);
  }
  if (failing.length) {
    console.error("Coverage rows that are not PASS/OK:");
    for (const line of failing) console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(
  `evidence:check OK — ${registered.length} tools, ${rows.length} coverage row(s) in docs/evidence/coverage.md`,
);
