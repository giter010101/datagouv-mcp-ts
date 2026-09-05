import { isDatagouvError, UnsupportedCapabilityError } from "../core/errors.js";
import type { ResourceDetail } from "../core/types.js";
import { defaultAccessors } from "./accessors/index.js";
import { degradePreview } from "./accessors/shared.js";
import { createCapabilityDetector } from "./capability.js";
import { fetchHead } from "./download.js";
import { createAccessorRegistry } from "./registry.js";
import type {
  AccessContext,
  CapabilityDetectorDeps,
  DetectOptions,
  FormatsDeps,
  OpenedResource,
} from "./types.js";

export function detectorDepsFrom(deps: FormatsDeps): CapabilityDetectorDeps {
  return {
    probeTabular: async (resourceId) =>
      deps.tabular ? deps.tabular.getProfile(resourceId) : undefined,
    crawlerExceptions: deps.crawlerExceptions ?? (async () => new Set<string>()),
    tabularApiBaseUrl: deps.tabularApiBaseUrl,
    maxDownloadBytes: deps.maxDownloadBytes,
    sniffHead: (url, bytes) => fetchHead(deps.http, url, bytes),
  };
}

export interface OpenResourceOptions extends DetectOptions {
  member?: string;
  signal?: AbortSignal;
}

/**
 * Stable formats-layer façade for tools: detect capability, resolve an accessor,
 * return getSchema / preview / query. `preview` never throws (degrades to metadata).
 */
export async function openResource(
  resourceMeta: ResourceDetail,
  deps: FormatsDeps,
  options: OpenResourceOptions = {},
): Promise<OpenedResource> {
  const detect = createCapabilityDetector(detectorDepsFrom(deps));
  const report = await detect(resourceMeta, {
    offline: options.offline,
    sniffBytes: options.sniffBytes,
  });
  const registry = createAccessorRegistry(defaultAccessors(deps));
  const ctx: AccessContext = {
    resource: resourceMeta,
    report,
    maxDownloadBytes: deps.maxDownloadBytes,
    member: options.member,
    signal: options.signal,
  };
  const accessor = registry.tryResolve(ctx) ?? defaultAccessors(deps).at(-1);
  if (!accessor) {
    throw new UnsupportedCapabilityError(`No accessor registered for resource ${resourceMeta.id}`);
  }
  return {
    resource: resourceMeta,
    report,
    accessor,
    getSchema: () => accessor.getSchema(ctx),
    preview: async (previewOptions) => {
      const inner: AccessContext = {
        ...ctx,
        member: previewOptions?.member ?? ctx.member,
      };
      try {
        return await accessor.preview(inner, previewOptions);
      } catch (error) {
        deps.logger?.debug(
          { err: isDatagouvError(error) ? error.toJSON() : String(error) },
          "preview degraded",
        );
        return degradePreview(inner, error);
      }
    },
    query: async (spec) => {
      if (!accessor.query) {
        throw new UnsupportedCapabilityError(
          `Resource ${resourceMeta.id} supports preview but not filtered queries (accessor ${accessor.id})`,
          {
            details: {
              resourceId: resourceMeta.id,
              accessor: accessor.id,
              primary: report.primary,
            },
            hint: "Use preview_resource for a sample, or pick a Tabular API / Parquet resource.",
          },
        );
      }
      return accessor.query(ctx, spec);
    },
  };
}
