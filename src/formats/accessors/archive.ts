import { unzipSync } from "fflate";
import { FormatError } from "../../core/errors.js";
import { formatFromUrl } from "../format-names.js";
import type { FormatsDeps, PreviewResult, ResourceAccessor } from "../types.js";
import { parseTableBytes } from "./parse-bytes.js";
import { DEFAULT_PREVIEW_LIMIT, downloadForAccess, resourceUrl, tablePreview } from "./shared.js";

export interface ZipEntry {
  name: string;
  sizeBytes: number | undefined;
  kind: string | undefined;
}

const SKIP_PREFIX = /(^|\/)(__MACOSX|\.ds_store$)/i;

export function listZipEntries(bytes: Uint8Array): {
  files: Record<string, Uint8Array>;
  entries: ZipEntry[];
} {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    throw new FormatError(
      `Could not read ZIP archive: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
        hint: "The file may not be a ZIP, or it uses an unsupported compression method.",
      },
    );
  }
  const entries: ZipEntry[] = Object.entries(files)
    .filter(([name, data]) => data.byteLength > 0 && !SKIP_PREFIX.test(name) && !name.endsWith("/"))
    .map(([name, data]) => ({
      name,
      sizeBytes: data.byteLength,
      kind: formatFromUrl(`file:///${name}`) ?? name.split(".").pop(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { files, entries };
}

function pickMember(
  files: Record<string, Uint8Array>,
  member: string | undefined,
): { name: string; bytes: Uint8Array } | undefined {
  if (member) {
    const exact = files[member];
    if (exact) return { name: member, bytes: exact };
    const match = Object.keys(files).find((n) => n === member || n.endsWith(`/${member}`));
    if (match && files[match]) return { name: match, bytes: files[match] };
    return undefined;
  }
  return undefined;
}

const TABLE_KINDS = new Set([
  "csv",
  "tsv",
  "txt",
  "json",
  "jsonl",
  "geojson",
  "xml",
  "kml",
  "xlsx",
  "xls",
  "ods",
]);

export function createArchiveAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "archive",
    capabilities: ["archive_inspect"],
    supports: (ctx) =>
      ctx.report.strategy === "archive" ||
      ctx.report.detectedFormat === "zip" ||
      ctx.report.detectedFormat === "kmz",
    async getSchema() {
      return undefined;
    },
    async preview(ctx, options): Promise<PreviewResult> {
      const download = await downloadForAccess(deps, ctx, resourceUrl(ctx), "truncate");
      const { files, entries } = listZipEntries(download.bytes);
      const member = options?.member ?? ctx.member;
      const picked = pickMember(files, member);
      const shpMembers = entries.filter(
        (e) => e.kind === "shp" || e.name.toLowerCase().endsWith(".shp"),
      );
      const notes: string[] = [];
      if (download.truncated) notes.push("ZIP download was truncated; listing may be incomplete.");
      if (shpMembers.length > 0) {
        notes.push(
          `Archive contains shapefile layer(s): ${shpMembers.map((e) => e.name).join(", ")}. Pass member to inspect a layer, or use a small zip with the shapefile accessor.`,
        );
      }
      if (picked) {
        const kind = formatFromUrl(`file:///${picked.name}`) ?? "bin";
        if (TABLE_KINDS.has(kind) || kind === "gml") {
          const format = kind === "kml" || kind === "gml" ? "xml" : kind;
          const table = await parseTableBytes(picked.bytes, {
            format,
            limit: options?.limit ?? DEFAULT_PREVIEW_LIMIT,
          });
          table.facts.member = picked.name;
          const preview = tablePreview(table, notes);
          return {
            ...preview,
            entries,
            facts: { ...preview.facts, entries: entries.length, member: picked.name },
          };
        }
        notes.push(`Member "${picked.name}" (${kind}) is listed but has no tabular parser.`);
      } else if (member) {
        notes.push(
          `Member "${member}" was not found. Available: ${entries
            .map((e) => e.name)
            .slice(0, 20)
            .join(", ")}`,
        );
      }
      return {
        kind: "entries",
        entries,
        facts: { entryCount: entries.length, truncated: download.truncated },
        notes,
      };
    },
  };
}
