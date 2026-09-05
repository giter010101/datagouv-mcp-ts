import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { USER_AGENT } from "../src/core/version.js";

/**
 * Record / refresh trimmed live API responses as contract fixtures.
 *
 *   pnpm fixtures:record                 # record every entry of the manifest
 *   pnpm fixtures:record --only tabular/ # prefix filter on fixture names
 *   pnpm fixtures:record --check         # exit 1 when a recorded fixture differs (drift detection)
 *   pnpm fixtures:record --dry-run       # fetch + trim, print a summary, write nothing
 *
 * Source of truth: `tests/fixtures/api/manifest.json` (stable IDs from research/02 §11,
 * research/03 §9). Output: `tests/fixtures/api/recorded/<name>.json` — always the shape
 * `{ "$fixture": {url,status,recordedAt,contentType}, "body": <trimmed json | text> }`
 * so tests can replay both the status and the body (`mockDatagouv` route builders
 * unwrap `body` automatically when they see `$fixture`).
 *
 * Determinism: arrays are trimmed to `maxItems` (keeping entries whose `id`/`name`
 * match `keepIds`/`keepNames`), object keys are sorted, volatile fields listed in
 * `redact` are replaced by a stable placeholder, and `recordedAt` is the only
 * timestamp that changes between runs (excluded from `--check`).
 */

interface ManifestEntry {
  name: string;
  url: string;
  note?: string;
  maxItems?: number;
  redact?: string[];
  expectStatus?: number;
  keepIds?: string[];
  keepNames?: string[];
  optional?: boolean;
  /** Long strings (descriptions, embedded HTML) are cut to this many chars. */
  maxStringLength?: number;
  method?: "GET" | "HEAD";
}

interface Manifest {
  defaults: { maxItems: number; redact: string[]; maxStringLength?: number };
  fixtures: ManifestEntry[];
}

export interface RecordedFixture {
  $fixture: {
    url: string;
    method: string;
    status: number;
    contentType: string | undefined;
    recordedAt: string;
    note?: string;
  };
  body: unknown;
}

const MANIFEST_DIR = resolve(process.cwd(), "tests/fixtures/api");
/** Recorded fixtures live in their own namespace so they never clobber hand-picked fixtures next to them. */
const ROOT = resolve(MANIFEST_DIR, "recorded");
const REDACTED = "[redacted]";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    check: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "timeout-ms": { type: "string", default: "30000" },
    manifest: { type: "string", default: resolve(MANIFEST_DIR, "manifest.json") },
  },
  strict: true,
});

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function trimArrays(
  value: unknown,
  entry: Required<Pick<ManifestEntry, "maxItems">> & ManifestEntry,
): unknown {
  if (Array.isArray(value)) {
    const keep = (item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const rec = item as Record<string, unknown>;
      return (
        (entry.keepIds ?? []).some((id) => rec.id === id || rec.resource_id === id) ||
        (entry.keepNames ?? []).some((n) => rec.name === n)
      );
    };
    const kept = value.filter(keep);
    const rest = value.filter((v) => !keep(v)).slice(0, Math.max(0, entry.maxItems - kept.length));
    return [...kept, ...rest].map((v) => trimArrays(v, entry));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = trimArrays(v, entry);
    }
    return out;
  }
  return value;
}

function truncateStrings(value: unknown, max: number): unknown {
  if (typeof value === "string")
    return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
  if (Array.isArray(value)) return value.map((v) => truncateStrings(v, max));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = truncateStrings(v, max);
    return out;
  }
  return value;
}

/** Redact dotted paths (`extras.check:date`) anywhere in the tree, including inside arrays. */
function redact(value: unknown, paths: string[]): unknown {
  const first = new Map<string, string[]>();
  for (const path of paths) {
    const [head, ...tail] = path.split(".");
    if (!head) continue;
    const existing = first.get(head) ?? [];
    if (tail.length > 0) existing.push(tail.join("."));
    else existing.push("");
    first.set(head, existing);
  }
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const rules = first.get(k);
      if (rules?.includes("")) {
        out[k] = v === null || v === undefined ? v : REDACTED;
        continue;
      }
      if (rules && rules.length > 0) {
        out[k] = redact(v, rules);
        continue;
      }
      out[k] = visit(v);
    }
    return out;
  };
  return visit(value);
}

function isRecorded(value: unknown): value is RecordedFixture {
  return typeof value === "object" && value !== null && "$fixture" in value && "body" in value;
}

function stripVolatile(fixture: RecordedFixture): string {
  const { recordedAt: _ignored, ...rest } = fixture.$fixture;
  return JSON.stringify({ $fixture: rest, body: fixture.body });
}

function readPrevious(path: string): RecordedFixture | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return isRecorded(parsed) ? parsed : undefined;
}

async function record(
  entry: ManifestEntry,
  defaults: Manifest["defaults"],
): Promise<RecordedFixture> {
  const method = entry.method ?? "GET";
  const response = await fetch(entry.url, {
    method,
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(Number(values["timeout-ms"])),
    redirect: "follow",
  });
  const expected = entry.expectStatus ?? 200;
  if (response.status !== expected) {
    throw new Error(
      `${entry.name}: expected HTTP ${expected}, got ${response.status} for ${entry.url}`,
    );
  }
  const contentType = response.headers.get("content-type") ?? undefined;
  const raw = await response.text();
  let body: unknown = raw;
  if (
    contentType?.includes("json") ||
    raw.trimStart().startsWith("{") ||
    raw.trimStart().startsWith("[")
  ) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (typeof body === "string" && body.length > 20_000)
    body = `${body.slice(0, 20_000)}\n…[truncated]`;
  const full = { ...entry, maxItems: entry.maxItems ?? defaults.maxItems };
  const maxStringLength = entry.maxStringLength ?? defaults.maxStringLength ?? 1500;
  const trimmed = sortKeys(
    truncateStrings(
      redact(trimArrays(body, full), [...defaults.redact, ...(entry.redact ?? [])]),
      maxStringLength,
    ),
  );
  return {
    $fixture: {
      url: entry.url,
      method,
      status: response.status,
      contentType,
      recordedAt: new Date().toISOString(),
      ...(entry.note ? { note: entry.note } : {}),
    },
    body: trimmed,
  };
}

const manifest = JSON.parse(readFileSync(String(values.manifest), "utf8")) as Manifest;
const selected = manifest.fixtures.filter((f) => !values.only || f.name.startsWith(values.only));
if (selected.length === 0) {
  console.error(`No fixture matches --only ${values.only}`);
  process.exit(2);
}

let failures = 0;
let drifted = 0;
let written = 0;
for (const entry of selected) {
  const target = resolve(ROOT, `${entry.name}.json`);
  const started = Date.now();
  try {
    const fixture = await record(entry, manifest.defaults);
    const ms = Date.now() - started;
    const previous = readPrevious(target);
    const changed = !previous || stripVolatile(previous) !== stripVolatile(fixture);
    if (values.check) {
      if (changed) {
        drifted++;
        console.log(`DRIFT ${entry.name} (${ms} ms)`);
      } else {
        console.log(`same  ${entry.name} (${ms} ms)`);
      }
      continue;
    }
    if (values["dry-run"]) {
      console.log(
        `${changed ? "would write" : "unchanged  "} ${entry.name} → HTTP ${fixture.$fixture.status} (${ms} ms)`,
      );
      continue;
    }
    if (changed) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`);
      written++;
      console.log(`wrote ${entry.name} → HTTP ${fixture.$fixture.status} (${ms} ms)`);
    } else {
      console.log(`same  ${entry.name} (${ms} ms)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (entry.optional) {
      console.warn(`skip  ${entry.name} (optional): ${message}`);
      continue;
    }
    failures++;
    console.error(`FAIL  ${entry.name}: ${message}`);
  }
}

console.log(
  `\n${selected.length} fixture(s): ${written} written, ${drifted} drifted, ${failures} failed` +
    (values.check ? " (check mode)" : values["dry-run"] ? " (dry run)" : ""),
);
process.exit(failures > 0 || drifted > 0 ? 1 : 0);
