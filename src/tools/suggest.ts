import { z } from "zod";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { defineTool } from "./types.js";

export const SUGGEST_KINDS = ["dataset", "organization", "tag", "zone", "format", "all"] as const;

export const suggestInputShape = {
  query: z.string().min(1).describe("Prefix or partial name to autocomplete (2+ characters recommended)."),
  kind: z
    .enum(SUGGEST_KINDS)
    .default("all")
    .describe("Restrict to one entity kind: dataset, organization, tag, zone (INSEE geozones), format. Default: all."),
  size: z.number().int().min(1).max(20).default(8).describe("Max suggestions per kind (1–20)."),
};

export const suggestOutputShape = {
  query: z.string(),
  kind: z.string(),
  suggestions: z.array(
    z.object({
      kind: z.string(),
      text: z.string(),
      id: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
};

export const suggestTool = defineTool<typeof suggestInputShape, ToolDeps>({
  name: "suggest",
  title: "Suggest (autocomplete)",
  description: [
    "Cheap autocomplete across datasets, organizations, tags, spatial zones and formats.",
    "",
    "Use it to disambiguate a name before a full search (e.g. which 'INSEE' organization, the exact",
    "tag slug, the geozone ID of a commune to pass as `geozone` to search_datasets). Returns for each",
    "suggestion: kind, display text, ID and URL when available. Faster and cheaper than search_datasets;",
    "results are prefix-based, not relevance-ranked.",
  ].join("\n"),
  inputSchema: suggestInputShape,
  outputSchema: suggestOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const all = await ctx.deps.datagouv.suggest(input.query, input.size);
    const suggestions = (input.kind === "all" ? all : all.filter((s) => s.kind === input.kind)).map(
      (s) => ({ kind: s.kind, text: s.text, id: s.id, url: s.url }),
    );
    const lines = [`Suggestions for '${input.query}'${input.kind !== "all" ? ` (${input.kind})` : ""}:`];
    if (suggestions.length === 0) {
      lines.push("  (none) — try a shorter prefix or search_datasets for full-text search.");
    }
    for (const s of suggestions) {
      lines.push(`  - [${s.kind}] ${s.text}${s.id ? ` (id: ${s.id})` : ""}${s.url ? ` ${s.url}` : ""}`);
    }
    return {
      text: lines.join("\n"),
      structured: { query: input.query, kind: input.kind, suggestions },
    };
  },
});
