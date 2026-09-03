/**
 * Typed error taxonomy shared by every layer.
 *
 * Every error carries a stable machine-readable `code`, an LLM-oriented `hint`
 * (what the caller should try next) and a `retryable` flag. Tool handlers never
 * throw raw strings: the tool registry maps `DatagouvError` instances to MCP
 * error results using `toJSON()`.
 */

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "CONFIG_ERROR",
  "NOT_FOUND",
  "API_ERROR",
  "RATE_LIMITED",
  "TIMEOUT",
  "NETWORK_ERROR",
  "FORMAT_ERROR",
  "RESOURCE_UNAVAILABLE",
  "UNSUPPORTED_CAPABILITY",
  "PAYLOAD_TOO_LARGE",
  "ENGINE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface DatagouvErrorOptions {
  cause?: unknown;
  /** Actionable advice for the LLM client (e.g. "call list_dataset_resources first"). */
  hint?: string;
  /** Structured context safe to expose to clients (no secrets). */
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export interface SerializedError {
  code: ErrorCode;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export class DatagouvError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, options: DatagouvErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }

  toJSON(): SerializedError {
    const out: SerializedError = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.hint !== undefined) out.hint = this.hint;
    if (this.details !== undefined) out.details = this.details;
    return out;
  }
}

export class ValidationError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("VALIDATION_ERROR", message, options);
  }
}

export class ConfigError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("CONFIG_ERROR", message, options);
  }
}

export class NotFoundError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("NOT_FOUND", message, options);
  }
}

export interface ApiErrorOptions extends DatagouvErrorOptions {
  status: number;
  url: string;
  body?: string;
}

/** Upstream HTTP failure (any data.gouv.fr service or remote resource host). */
export class ApiError extends DatagouvError {
  readonly status: number;
  readonly url: string;

  constructor(message: string, options: ApiErrorOptions) {
    const { status, url, body, ...rest } = options;
    super("API_ERROR", message, {
      ...rest,
      retryable: rest.retryable ?? status >= 500,
      details: { ...rest.details, status, url, ...(body !== undefined ? { body } : {}) },
    });
    this.status = status;
    this.url = url;
  }
}

export class RateLimitError extends DatagouvError {
  readonly retryAfterMs: number | undefined;

  constructor(message: string, options: DatagouvErrorOptions & { retryAfterMs?: number } = {}) {
    const { retryAfterMs, ...rest } = options;
    super("RATE_LIMITED", message, {
      ...rest,
      retryable: true,
      details: { ...rest.details, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) },
    });
    this.retryAfterMs = retryAfterMs;
  }
}

export class TimeoutError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("TIMEOUT", message, { ...options, retryable: true });
  }
}

export class NetworkError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("NETWORK_ERROR", message, { ...options, retryable: true });
  }
}

/** The bytes could not be parsed as the expected format. */
export class FormatError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("FORMAT_ERROR", message, options);
  }
}

/** Resource exists in the catalog but its file cannot be accessed (dead link, 4xx on remote…). */
export class ResourceUnavailableError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("RESOURCE_UNAVAILABLE", message, options);
  }
}

/** The requested operation is not possible for this resource's detected capability. */
export class UnsupportedCapabilityError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("UNSUPPORTED_CAPABILITY", message, options);
  }
}

export class PayloadTooLargeError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("PAYLOAD_TOO_LARGE", message, options);
  }
}

/** Optional engine (e.g. DuckDB) requested but not installed/enabled. */
export class EngineUnavailableError extends DatagouvError {
  constructor(message: string, options: DatagouvErrorOptions = {}) {
    super("ENGINE_UNAVAILABLE", message, options);
  }
}

export function isDatagouvError(value: unknown): value is DatagouvError {
  return value instanceof DatagouvError;
}

/** Normalise any thrown value into a `DatagouvError` (never leaks stack traces to clients). */
export function toDatagouvError(value: unknown): DatagouvError {
  if (isDatagouvError(value)) return value;
  if (value instanceof Error) {
    if (value.name === "AbortError" || value.name === "TimeoutError") {
      return new TimeoutError(value.message || "Operation timed out", { cause: value });
    }
    return new DatagouvError("INTERNAL_ERROR", value.message || "Unexpected error", {
      cause: value,
    });
  }
  return new DatagouvError(
    "INTERNAL_ERROR",
    typeof value === "string" ? value : "Unexpected error",
  );
}
