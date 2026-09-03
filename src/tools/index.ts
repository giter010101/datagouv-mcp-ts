import { type SearchDatasetsDeps, searchDatasetsTool } from "./search-datasets.js";
import type { AnyToolDefinition } from "./types.js";

export * from "./registry.js";
export * from "./search-datasets.js";
export * from "./shared/annotations.js";
export * from "./shared/search-query.js";
export * from "./types.js";

/**
 * Dependencies required by the currently registered tools. Widened by
 * workstream C as tools are added (target: `Clients & { formats: ...; config: ... }`).
 */
export type ToolDeps = SearchDatasetsDeps;

/** Registration order matters for some clients: keep legacy order (ADR 0007). */
export const ALL_TOOLS: ReadonlyArray<AnyToolDefinition<ToolDeps>> = [searchDatasetsTool];
