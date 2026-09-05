import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Architectural layering check (ADR 0004):
 *   core ← clients ← formats ← tools ← server
 * A file in layer N may import only from layers ≤ N. `src/index.ts` (CLI) may import anything.
 * Run: `pnpm check:layers`. Also executed by `tests/unit/layering.test.ts`.
 */

export const LAYERS = ["core", "clients", "formats", "tools", "server"] as const;
export type Layer = (typeof LAYERS)[number];

export interface LayerViolation {
  file: string;
  importPath: string;
  fromLayer: Layer;
  toLayer: Layer;
}

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function layerOf(relPath: string): Layer | undefined {
  const [first] = relPath.split(/[\\/]/);
  return (LAYERS as readonly string[]).includes(first ?? "") ? (first as Layer) : undefined;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

export function checkLayers(srcDir: string): LayerViolation[] {
  const violations: LayerViolation[] = [];
  for (const file of walk(srcDir)) {
    const rel = relative(srcDir, file);
    const fromLayer = layerOf(rel);
    if (!fromLayer) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec?.startsWith(".")) continue;
      const target = relative(srcDir, resolve(dirname(file), spec));
      if (target.startsWith("..")) continue;
      const toLayer = layerOf(target.split(sep).join("/"));
      if (!toLayer) continue;
      if (LAYERS.indexOf(toLayer) > LAYERS.indexOf(fromLayer)) {
        violations.push({ file: rel, importPath: spec, fromLayer, toLayer });
      }
    }
  }
  return violations;
}

export function formatViolations(violations: LayerViolation[]): string {
  return violations
    .map(
      (v) =>
        `  ${v.file}: imports "${v.importPath}" (${v.fromLayer} → ${v.toLayer}). ` +
        `Move the shared code down to "${v.fromLayer}" or invert the dependency.`,
    )
    .join("\n");
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const srcDir = resolve(process.argv[2] ?? "src");
  const violations = checkLayers(srcDir);
  if (violations.length > 0) {
    console.error(`Layering violations (${violations.length}):\n${formatViolations(violations)}`);
    process.exit(1);
  }
  console.log(`check:layers OK — ${LAYERS.join(" ← ")} respected in ${srcDir}`);
}
