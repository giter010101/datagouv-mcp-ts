import {
  ApiError,
  DatagouvError,
  NotFoundError,
  RateLimitError,
  ResourceUnavailableError,
  TimeoutError,
  ValidationError,
} from "../../core/errors.js";

/** LLM-facing messages ported verbatim from the legacy `tabular_api_client.py`. */
export const MSG_RESOURCE_NOT_IN_TABULAR =
  "This resource ID was not found in the Tabular API. " +
  "Use search_datasets to find a dataset, then list_dataset_resources " +
  "to obtain the correct resource ID.";

export const MSG_TABULAR_SERVER_ISSUE =
  "The Tabular API is temporarily unavailable or returned a server error. " +
  "Please try again in about one minute.";

export const MSG_TABULAR_BAD_REQUEST =
  "The Tabular API rejected the request (invalid filter, sort column, or parameter). " +
  "Call again without sort or filter to preview rows and confirm column names, " +
  "or align filter_column and sort_column with the resource schema.";

export const MSG_TABULAR_COLUMN_HINT =
  "A column or parameter in the request does not exist in this resource; " +
  "remove sort/filter or use exact names from a preview.";

/**
 * Translate a Tabular API failure into the legacy wording, keeping the typed
 * error so the registry still emits `isError` + `structuredContent.error`.
 */
export function mapTabularError(error: unknown, resourceId: string): DatagouvError {
  if (error instanceof NotFoundError) {
    return new ResourceUnavailableError(MSG_RESOURCE_NOT_IN_TABULAR, {
      cause: error,
      details: { resource_id: resourceId, upstream: "tabular-api" },
      hint: "The resource exists in the catalogue but is not served by the Tabular API. Use get_resource_info to see how it can be accessed, or preview_resource / query_resource which route by detected format.",
    });
  }
  if (error instanceof RateLimitError || error instanceof TimeoutError) {
    return new ApiError(MSG_TABULAR_SERVER_ISSUE, {
      status: error instanceof RateLimitError ? 429 : 408,
      url: "tabular-api",
      cause: error,
      retryable: true,
      hint: "Retry in about one minute with a smaller page_size or fewer filters.",
    });
  }
  if (error instanceof ApiError) {
    if (error.status >= 500 || error.status === 408 || error.status === 429) {
      return new ApiError(MSG_TABULAR_SERVER_ISSUE, {
        status: error.status,
        url: error.url,
        cause: error,
        retryable: true,
        hint: "Retry in about one minute.",
      });
    }
    if (error.status === 401 || error.status === 403) {
      return new ApiError(
        `The Tabular API returned HTTP ${error.status} (access or permission). If the problem persists, try again in about one minute.`,
        { status: error.status, url: error.url, cause: error, retryable: false },
      );
    }
    const body = typeof error.details?.body === "string" ? error.details.body : "";
    const columnHint = /does not exist|unknown column|invalid column/i.test(body)
      ? ` ${MSG_TABULAR_COLUMN_HINT}`
      : "";
    return new ValidationError(`${MSG_TABULAR_BAD_REQUEST}${columnHint}`, {
      cause: error,
      details: { status: error.status, resource_id: resourceId },
      hint: "Call get_resource_schema to list exact column names, then retry.",
    });
  }
  if (error instanceof DatagouvError) return error;
  return new DatagouvError("INTERNAL_ERROR", `Error querying resource: ${String(error)}`, {
    cause: error,
  });
}
