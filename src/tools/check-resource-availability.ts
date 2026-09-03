import { z } from "zod";
import { ApiError, toDatagouvError } from "../core/errors.js";
import type { ResourceDetail } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { humanSize, kv, lines } from "./shared/formatters.js";
import { getResourceOrThrow } from "./shared/resource-access.js";
import { defineTool } from "./types.js";

const LIVE_PROBE_TIMEOUT_MS = 8_000;

export const checkResourceAvailabilityInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID."),
  live: z
    .boolean()
    .default(true)
    .describe(
      "Also send a HEAD request to the file URL now (default true). Set false to rely only on the platform's last crawler check.",
    ),
};

const platformCheckSchema = z.object({
  available: z.boolean().optional(),
  status: z.number().optional(),
  error: z.string().optional(),
  checked_at: z.string().optional(),
  detected_mime: z.string().optional(),
  content_length: z.number().optional(),
});

const liveCheckSchema = z.object({
  ok: z.boolean(),
  status: z.number().optional(),
  method: z.string(),
  final_url: z.string().optional(),
  content_type: z.string().optional(),
  content_length: z.number().optional(),
  last_modified: z.string().optional(),
  error: z.string().optional(),
  duration_ms: z.number(),
});

type LiveCheckSuccess = {
  ok: true;
  status?: number;
  method: "GET" | "HEAD";
  final_url?: string;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  error?: undefined;
  duration_ms: number;
};

type LiveCheckFailure = {
  ok: false;
  status?: number;
  method: "GET" | "HEAD";
  final_url?: string;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  error: string;
  duration_ms: number;
};

export const checkResourceAvailabilityOutputShape = {
  resource_id: z.string(),
  title: z.string(),
  url: z.string(),
  latest_url: z.string(),
  filetype: z.string(),
  verdict: z.enum(["available", "unavailable", "unknown"]),
  platform_check: platformCheckSchema,
  live_check: liveCheckSchema.optional(),
  recommendation: z.string(),
};

export const checkResourceAvailabilityTool = defineTool<
  typeof checkResourceAvailabilityInputShape,
  ToolDeps
>({
  name: "check_resource_availability",
  title: "Check resource availability",
  description: [
    "Check whether a resource's file URL is actually reachable before spending calls on it.",
    "",
    "Combines the platform's last crawler check (status, date, detected MIME, size — stored in",
    "the resource metadata) with an optional live HEAD request (no body download). Useful because",
    "many resources are remote links maintained by third parties and a large share suffer link rot.",
    "Returns a verdict (available / unavailable / unknown), the HTTP status, content type, size,",
    "last-modified date and a recommendation (which tool to call next, or to pick another resource).",
    "Use it before preview_resource / query_resource on remote (`filetype: remote`) resources.",
  ].join("\n"),
  inputSchema: checkResourceAvailabilityInputShape,
  outputSchema: checkResourceAvailabilityOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const resource = await getResourceOrThrow(ctx.deps, input.resource_id);
    const platform = platformCheck(resource);
    const live = input.live ? await liveCheck(ctx.deps, resource, ctx.signal) : undefined;

    let verdict: "available" | "unavailable" | "unknown" = "unknown";
    if (live) verdict = live.ok ? "available" : "unavailable";
    else if (platform.available === true) verdict = "available";
    else if (platform.available === false) verdict = "unavailable";

    const recommendation =
      verdict === "unavailable"
        ? "The file is not reachable: pick another resource of the dataset (list_dataset_resources) or contact the publisher via the dataset page."
        : verdict === "available"
          ? "The file is reachable: call get_resource_info for the access path, then preview_resource or query_resource."
          : "No check information: call get_resource_info, then preview_resource with a small limit.";

    const text = lines(
      `Availability check: ${resource.title || "Untitled"}`,
      `Resource ID: ${resource.id}`,
      kv("URL", resource.url),
      kv("File type", resource.filetype),
      "",
      "Platform crawler check:",
      platform.available === undefined && platform.status === undefined
        ? "  No check recorded yet."
        : undefined,
      platform.available !== undefined
        ? `  Available: ${platform.available ? "yes" : "no"}`
        : undefined,
      platform.status !== undefined ? `  HTTP status: ${platform.status}` : undefined,
      platform.error ? `  Error: ${platform.error}` : undefined,
      platform.checked_at ? `  Checked at: ${platform.checked_at}` : undefined,
      platform.detected_mime ? `  Detected MIME: ${platform.detected_mime}` : undefined,
      platform.content_length !== undefined
        ? `  Content length: ${humanSize(platform.content_length)}`
        : undefined,
      live ? "" : undefined,
      live ? `Live check (${live.method}, ${live.duration_ms} ms):` : undefined,
      live ? `  Reachable: ${live.ok ? "yes" : "no"}` : undefined,
      live?.status !== undefined ? `  HTTP status: ${live.status}` : undefined,
      live?.content_type ? `  Content type: ${live.content_type}` : undefined,
      live?.content_length !== undefined
        ? `  Content length: ${humanSize(live.content_length)}`
        : undefined,
      live?.last_modified ? `  Last modified: ${live.last_modified}` : undefined,
      live?.final_url && live.final_url !== resource.url
        ? `  Final URL: ${live.final_url}`
        : undefined,
      live?.error ? `  Error: ${live.error}` : undefined,
      "",
      `Verdict: ${verdict}`,
      `Recommendation: ${recommendation}`,
    );

    return {
      text,
      structured: {
        resource_id: resource.id,
        title: resource.title,
        url: resource.url,
        latest_url: resource.latestUrl,
        filetype: resource.filetype,
        verdict,
        platform_check: platform,
        live_check: live,
        recommendation,
      },
    };
  },
});

function platformCheck(resource: ResourceDetail) {
  const a = resource.analysis;
  return {
    available: a.checkAvailable,
    status: a.checkStatus,
    error: a.checkError,
    checked_at: a.checkDate,
    detected_mime: a.detectedMime,
    content_length: a.contentLength,
  };
}

async function liveCheck(
  deps: ToolDeps,
  resource: ResourceDetail,
  signal: AbortSignal | undefined,
) {
  const started = Date.now();
  const target = resource.url || resource.latestUrl;
  const attempt = async (method: "GET" | "HEAD"): Promise<LiveCheckSuccess> => {
    const response = await deps.http.request(target, {
      method,
      retries: 0,
      timeoutMs: LIVE_PROBE_TIMEOUT_MS,
      signal,
      ...(method === "GET" ? { headers: { range: "bytes=0-0" } } : {}),
    });
    await response.body?.cancel().catch(() => undefined);
    const length = response.headers.get("content-length");
    return {
      ok: true,
      status: response.status,
      method,
      final_url: response.url || undefined,
      content_type: response.headers.get("content-type") ?? undefined,
      content_length: length !== null && /^\d+$/.test(length) ? Number(length) : undefined,
      last_modified: response.headers.get("last-modified") ?? undefined,
      error: undefined,
      duration_ms: Date.now() - started,
    };
  };
  try {
    return await attempt("HEAD");
  } catch (headError) {
    const mapped = toDatagouvError(headError);
    // Some hosts refuse HEAD: confirm with a 1-byte ranged GET before declaring the link dead.
    if (mapped instanceof ApiError && [400, 403, 405, 501].includes(mapped.status)) {
      try {
        return await attempt("GET");
      } catch (getError) {
        return failure(toDatagouvError(getError), "GET", started);
      }
    }
    return failure(mapped, "HEAD", started);
  }
}

function failure(
  error: ReturnType<typeof toDatagouvError>,
  method: "GET" | "HEAD",
  started: number,
): LiveCheckFailure {
  return {
    ok: false,
    status: error instanceof ApiError ? error.status : undefined,
    method,
    error: `${error.code}: ${error.message}`,
    final_url: undefined,
    content_type: undefined,
    content_length: undefined,
    last_modified: undefined,
    duration_ms: Date.now() - started,
  };
}
