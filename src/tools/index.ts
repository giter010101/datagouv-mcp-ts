// New tools (alphabetical)
import { checkResourceAvailabilityTool } from "./check-resource-availability.js";
import type { ToolDeps } from "./deps.js";
import { getDataserviceInfoTool } from "./get-dataservice-info.js";
import { getDataserviceOpenapiSpecTool } from "./get-dataservice-openapi-spec.js";
import { getDatasetInfoTool } from "./get-dataset-info.js";
import { getDatasetResourcesSummaryTool } from "./get-dataset-resources-summary.js";
import { getMetricsTool } from "./get-metrics.js";
import { getResourceInfoTool } from "./get-resource-info.js";
import { getResourceSchemaTool } from "./get-resource-schema.js";
import { listDatasetResourcesTool } from "./list-dataset-resources.js";
import { listHighValueDatasetsTool } from "./list-high-value-datasets.js";
import { previewResourceTool } from "./preview-resource.js";
import { queryResourceTool } from "./query-resource.js";
import { queryResourceDataTool } from "./query-resource-data.js";
import { getReuseInfoTool, searchReusesTool } from "./reuses.js";
import { searchDataservicesTool } from "./search-dataservices.js";
// Legacy tools (ADR 0007 order)
import { searchDatasetsTool } from "./search-datasets.js";
import { searchOrganizationsTool } from "./search-organizations.js";
import { suggestTool } from "./suggest.js";
import { getTopicTool, listTopicsTool } from "./topics.js";
import type { AnyToolDefinition } from "./types.js";

export * from "./registry.js";
export * from "./search-datasets.js";
export * from "./shared/annotations.js";
export * from "./shared/search-query.js";
export * from "./types.js";

export type { ToolDeps };

/**
 * All registered MCP tools. Legacy tools first (ADR 0007), then new tools alphabetically.
 * Markdown catalogue for README: `tsx scripts/print-tool-catalog.ts`.
 */
export const ALL_TOOLS: ReadonlyArray<AnyToolDefinition<ToolDeps>> = [
  // Legacy (10)
  searchDatasetsTool,
  searchOrganizationsTool,
  searchDataservicesTool,
  getDataserviceInfoTool,
  getDataserviceOpenapiSpecTool,
  getDatasetInfoTool,
  listDatasetResourcesTool,
  getResourceInfoTool,
  queryResourceDataTool,
  getMetricsTool,
  // New
  checkResourceAvailabilityTool,
  getDatasetResourcesSummaryTool,
  getResourceSchemaTool,
  getReuseInfoTool,
  listHighValueDatasetsTool,
  listTopicsTool,
  getTopicTool,
  previewResourceTool,
  queryResourceTool,
  searchReusesTool,
  suggestTool,
];
