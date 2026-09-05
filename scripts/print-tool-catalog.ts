/**
 * Print a markdown tool catalogue from `ALL_TOOLS` (registration order).
 *
 *   tsx scripts/print-tool-catalog.ts
 *
 * Columns: # | Name | Title | Legacy | Description (first line)
 */
import { ALL_TOOLS } from "../src/tools/index.js";

function firstLine(description: string): string {
  const line = description.trim().split(/\r?\n/)[0] ?? "";
  return line.replace(/\|/g, "\\|").trim();
}

const header = "| # | Name | Title | Legacy | Description (first line) |";
const sep = "|---|------|-------|--------|--------------------------|";

const rows = ALL_TOOLS.map((tool, index) => {
  const n = index + 1;
  const legacy = tool.legacy === true ? "yes" : "no";
  return `| ${n} | \`${tool.name}\` | ${tool.title} | ${legacy} | ${firstLine(tool.description)} |`;
});

console.log([header, sep, ...rows].join("\n"));
