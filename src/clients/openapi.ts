import { parse as parseYaml } from "yaml";
import { FormatError } from "../core/errors.js";

/**
 * OpenAPI / Swagger document helpers shared by `DatagouvClient.fetchOpenApiSpec`
 * and `TabularClient.getSwagger`. Pure functions: no I/O here.
 */

/** Parse a JSON-or-YAML document into an object; throws `FormatError` otherwise. */
export function parseOpenApiDocument(text: string, sourceUrl: string): Record<string, unknown> {
  return parseJsonOrYamlObject(text, sourceUrl, "OpenAPI document");
}

export function parseJsonOrYamlObject(
  text: string,
  sourceUrl: string,
  label = "document",
): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new FormatError(`Empty ${label} at ${sourceUrl}`, { details: { url: sourceUrl } });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      parsed = parseYaml(trimmed);
    } catch (error) {
      throw new FormatError(`Could not parse ${label} at ${sourceUrl} as JSON or YAML`, {
        cause: error,
        details: { url: sourceUrl },
      });
    }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FormatError(`The ${label} at ${sourceUrl} is not an object`, {
      details: { url: sourceUrl },
    });
  }
  return parsed as Record<string, unknown>;
}

export interface OpenApiParameterSummary {
  name: string;
  in: string;
  type: string | undefined;
  required: boolean;
  description: string | undefined;
}

export interface OpenApiEndpointSummary {
  method: string;
  path: string;
  summary: string | undefined;
  parameters: OpenApiParameterSummary[];
}

export interface OpenApiSummary {
  title: string | undefined;
  version: string | undefined;
  description: string | undefined;
  /** OpenAPI 3 `servers[].url` or Swagger 2 `schemes://host/basePath` (max 3). */
  servers: string[];
  endpoints: OpenApiEndpointSummary[];
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const MAX_SERVERS = 3;

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Endpoint-level summary (legacy `get_dataservice_openapi_spec` semantics: no schemas dumped). */
export function summarizeOpenApiSpec(spec: Record<string, unknown>): OpenApiSummary {
  const info = asRecord(spec.info) ?? {};
  const servers: string[] = [];
  for (const server of Array.isArray(spec.servers) ? spec.servers : []) {
    const url = asString(asRecord(server)?.url);
    if (url) servers.push(url);
  }
  if (servers.length === 0 && typeof spec.host === "string") {
    const schemes = Array.isArray(spec.schemes) ? spec.schemes : ["https"];
    for (const scheme of schemes) {
      servers.push(`${String(scheme)}://${spec.host}${asString(spec.basePath) ?? ""}`);
    }
  }

  const endpoints: OpenApiEndpointSummary[] = [];
  for (const [path, item] of Object.entries(asRecord(spec.paths) ?? {})) {
    const pathItem = asRecord(item);
    if (!pathItem) continue;
    const shared = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const operation = asRecord(op);
      if (!operation) continue;
      const own = Array.isArray(operation.parameters) ? operation.parameters : [];
      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: asString(operation.summary) ?? asString(operation.description),
        parameters: [...shared, ...own].flatMap((p) => {
          const param = asRecord(p);
          const name = asString(param?.name);
          if (!param || !name) return [];
          const schema = asRecord(param.schema);
          return [
            {
              name,
              in: asString(param.in) ?? "query",
              type: asString(schema?.type) ?? asString(param.type),
              required: param.required === true,
              description: asString(param.description),
            },
          ];
        }),
      });
    }
  }

  return {
    title: asString(info.title),
    version: asString(info.version),
    description: asString(info.description),
    servers: servers.slice(0, MAX_SERVERS),
    endpoints,
  };
}
