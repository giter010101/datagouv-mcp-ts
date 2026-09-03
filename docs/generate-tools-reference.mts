/**
 * Regenerates docs/tools.md from the tool definitions in src/tools/*.ts.
 *
 *   pnpm docs:tools
 *
 * Owned by the docs workstream (docs/**); kept outside scripts/ so it is not part of the
 * typecheck/lint surface. Reads each tool file, extracts exported ToolDefinitions, turns their
 * Zod input shapes into parameter tables and marks which ones are registered in ALL_TOOLS.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const toolsDir = resolve(root, "src/tools");
const outFile = resolve(here, "tools.md");
const headerFile = resolve(here, "tools.header.md");

const skip = new Set(["index.ts", "registry.ts", "types.ts", "deps.ts"]);
const files = readdirSync(toolsDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !skip.has(f))
  .sort();

interface ToolLike {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: unknown;
}
interface Param {
  name: string;
  type: string;
  required: boolean;
  def: unknown;
  desc: string;
}

function isTool(v: unknown): v is ToolLike {
  return (
    typeof v === "object" &&
    v !== null &&
    "name" in v &&
    "inputSchema" in v &&
    "handler" in v &&
    "description" in v
  );
}

function describeShape(shape: Record<string, z.ZodTypeAny>): Param[] {
  const js = z.toJSONSchema(z.object(shape), { io: "input", unrepresentable: "any" }) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const required = new Set(js.required ?? []);
  return Object.entries(js.properties ?? {}).map(([name, p]) => {
    let type = String(p.type ?? (p.anyOf ? "union" : "object"));
    if (Array.isArray(p.enum)) type = p.enum.map((v) => `\`${String(v)}\``).join(" \\| ");
    if (type === "array" && p.items && typeof p.items === "object") {
      const items = p.items as Record<string, unknown>;
      type = `array<${String(items.type ?? "object")}>`;
    }
    const bounds: string[] = [];
    if (typeof p.minimum === "number") bounds.push(`≥ ${p.minimum}`);
    if (typeof p.maximum === "number" && p.maximum < 1e9) bounds.push(`≤ ${p.maximum}`);
    if (typeof p.maxItems === "number") bounds.push(`≤ ${p.maxItems} items`);
    if (bounds.length > 0) type += ` (${bounds.join(", ")})`;
    return {
      name,
      type,
      required: required.has(name),
      def: p.default,
      desc: String(p.description ?? "").replace(/\s*\n\s*/g, " "),
    };
  });
}

let registered: string[] = [];
try {
  const index = (await import(pathToFileURL(resolve(toolsDir, "index.ts")).href)) as {
    ALL_TOOLS?: ReadonlyArray<{ name: string }>;
  };
  registered = (index.ALL_TOOLS ?? []).map((t) => t.name);
} catch (error) {
  console.error(`could not import src/tools/index.ts: ${(error as Error).message}`);
}
const order = new Map(registered.map((n, i) => [n, i]));

const tools: Array<{ tool: ToolLike; params: Param[]; file: string }> = [];
for (const file of files) {
  let mod: Record<string, unknown> = {};
  try {
    mod = (await import(pathToFileURL(resolve(toolsDir, file)).href)) as Record<string, unknown>;
  } catch (error) {
    console.error(`skip ${file}: ${(error as Error).message}`);
    continue;
  }
  for (const value of Object.values(mod)) {
    if (isTool(value)) tools.push({ tool: value, params: describeShape(value.inputSchema), file });
  }
}
tools.sort(
  (a, b) =>
    (order.get(a.tool.name) ?? 999) - (order.get(b.tool.name) ?? 999) ||
    a.tool.name.localeCompare(b.tool.name),
);

const lines: string[] = [readFileSync(headerFile, "utf8").trimEnd(), ""];
lines.push(
  `<!-- generated ${new Date().toISOString().slice(0, 10)} by docs/generate-tools-reference.mts — do not edit below this line -->`,
  "",
  "## Summary",
  "",
  "| Tool | Title | Registered | Required parameters |",
  "|------|-------|------------|---------------------|",
);
for (const { tool, params } of tools) {
  const req = params.filter((p) => p.required).map((p) => `\`${p.name}\``).join(", ") || "—";
  lines.push(`| \`${tool.name}\` | ${tool.title} | ${order.has(tool.name) ? "yes" : "not yet"} | ${req} |`);
}
lines.push("", "## Tools", "");
for (const { tool, params, file } of tools) {
  const status = order.has(tool.name) ? "registered" : "in `src/tools` but not yet in `ALL_TOOLS`";
  lines.push(`### \`${tool.name}\``, "", `**${tool.title}** — \`src/tools/${file}\` (${status})`, "");
  lines.push(tool.description.trim(), "");
  lines.push(
    "| Parameter | Type | Required | Default | Description |",
    "|-----------|------|----------|---------|-------------|",
  );
  for (const p of params) {
    const def = p.def === undefined ? "—" : `\`${JSON.stringify(p.def)}\``;
    lines.push(
      `| \`${p.name}\` | ${p.type} | ${p.required ? "yes" : "no"} | ${def} | ${p.desc.replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push("");
}

writeFileSync(outFile, `${lines.join("\n").trimEnd()}\n`);
console.error(
  `wrote ${outFile}: ${tools.length} tools (${registered.length} registered: ${registered.join(", ") || "none"})`,
);
