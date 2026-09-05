import { NotFoundError, UnsupportedCapabilityError } from "../../core/errors.js";
import type { ResourceDetail } from "../../core/types.js";
import type { AccessContext, CapabilityReport, ResourceAccessor } from "../../formats/types.js";
import type { ToolDeps } from "../deps.js";
import { recommendationFor } from "./capability-hints.js";

export interface OpenedResource {
  resource: ResourceDetail;
  report: CapabilityReport;
  ctx: AccessContext;
  /** `undefined` when no accessor handles the detected capability. */
  accessor: ResourceAccessor | undefined;
}

export const LEGACY_RESOURCE_NOT_FOUND = (resourceId: string) =>
  `Error: Resource with ID '${resourceId}' not found.`;

export const LEGACY_DATASET_NOT_FOUND = (datasetId: string) =>
  `Error: Dataset with ID '${datasetId}' not found.`;

/** Fetch a resource, mapping 404 to the legacy in-band message (ADR 0007 §6). */
export async function getResourceOrThrow(
  deps: ToolDeps,
  resourceId: string,
): Promise<ResourceDetail> {
  try {
    return await deps.datagouv.getResource(resourceId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(LEGACY_RESOURCE_NOT_FOUND(resourceId), {
        cause: error,
        details: { resource_id: resourceId },
        hint: "Check the ID with list_dataset_resources (resource IDs are UUIDs, dataset IDs are 24-hex strings).",
      });
    }
    throw error;
  }
}

export async function getDatasetOrThrow(deps: ToolDeps, datasetId: string) {
  try {
    return await deps.datagouv.getDataset(datasetId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(LEGACY_DATASET_NOT_FOUND(datasetId), {
        cause: error,
        details: { dataset_id: datasetId },
        hint: "Find the right dataset ID or slug with search_datasets.",
      });
    }
    throw error;
  }
}

/**
 * One-stop "open" for the data tools: resource metadata → capability report →
 * accessor resolution. Detection is delegated to the formats layer (cached there).
 */
export async function openResource(
  deps: ToolDeps,
  resourceId: string,
  options: { offline?: boolean; signal?: AbortSignal } = {},
): Promise<OpenedResource> {
  const resource = await getResourceOrThrow(deps, resourceId);
  const report = await deps.formats.detectCapability(resource, { offline: options.offline });
  const ctx: AccessContext = {
    resource,
    report,
    maxDownloadBytes: deps.config.http.maxDownloadBytes,
    signal: options.signal,
  };
  return { resource, report, ctx, accessor: deps.formats.registry.tryResolve(ctx) };
}

/** Throw a precise, actionable error when no accessor can serve `operation`. */
export function requireAccessor(opened: OpenedResource, operation: "preview" | "schema" | "query") {
  const { accessor, report, resource } = opened;
  const rec = recommendationFor(report.primary);
  if (!accessor) {
    throw new UnsupportedCapabilityError(
      `Resource ${resource.id} cannot be ${operation === "schema" ? "described" : `${operation}ed`}: detected capability is '${report.primary}' (format '${report.detectedFormat || "unknown"}') and no data accessor handles it.`,
      {
        details: {
          resource_id: resource.id,
          primary: report.primary,
          capabilities: report.capabilities,
        },
        hint: `${rec.hint} Next tool: ${rec.tool}.`,
      },
    );
  }
  if (operation === "query" && !accessor.query) {
    throw new UnsupportedCapabilityError(
      `Resource ${resource.id} (capability '${report.primary}') supports preview but not filtered queries.`,
      {
        details: { resource_id: resource.id, primary: report.primary, accessor: accessor.id },
        hint: "Use preview_resource to read the first rows, or the download URL from get_resource_info.",
      },
    );
  }
  return accessor;
}
