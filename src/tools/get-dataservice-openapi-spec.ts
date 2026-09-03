import { z } from "zod";
import { truncate } from "../core/text.js";
import type { ToolDeps } from "./deps.js";
import { getDataserviceOrThrow } from "./get-dataservice-info.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { defineTool } from "./types.js";

const MAX_SERVERS = 3;
const MAX_ENDPOINTS = 150;
const SUMMARY_CHARS = 120;
const INFO_DESCRIPTION_CHARS = 300;

export const getDataserviceOpenapiSpecInputShape = {
  dataservice_id: z.string().min(1).describe("Dataservice (third-party API) ID or slug."),
};

export interface EndpointSummary {
  method: string;
  path: string;
  summary: string | undefined;
  parameters: Array<{ name: string; location: string; type: string; required: boolean }>;
}

export interface SpecSummary {
  title: string | undefined;
  version: string | undefined;
  description: string | undefined;
  servers: Array<{ url: string; description: string | undefined }>;
  endpointsTotal: number;
  endpoints: EndpointSummary[];
}

const endpointSchema = z.object({
  method: z.string(),
  path: z.string(),
  summary: z.string().optional(),
  parameters: z.array(
    z.object({ name: z.string(), location: z.string(), type: z.string(), required: z.boolean() }),
  ),
});

export const getDataserviceOpenapiSpecOutputShape = {
  dataservice_id: z.string(),
  title: z.string(),
  source_url: z.string().optional(),
  base_api_url: z.string().optional(),
  has_spec: z.boolean(),
  message: z.string().optional(),
  api: z
    .object({
      title: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
      servers: z.array(z.object({ url: z.string(), description: z.string().optional() })),
      endpoints_total: z.number().int(),
      endpoints: z.array(endpointSchema),
    })
    .optional(),
};

export const getDataserviceOpenapiSpecTool = defineTool<
  typeof getDataserviceOpenapiSpecInputShape,
  ToolDeps
>({
  name: "get_dataservice_openapi_spec",
  title: "Get third-party API OpenAPI spec",
  legacy: true,
  description: [
    "Fetch and summarize the OpenAPI/Swagger spec for a third-party API (dataservice).",
    "",
    "Retrieves machine_documentation_url from catalog metadata (dataservice record),",
    "fetches the spec, and returns a summary of available endpoints with",
    "their parameters. Use this to understand how to call the API.",
    "Response schemas, models and examples are omitted on purpose; servers are capped to 3",
    `and endpoints to ${MAX_ENDPOINTS}.`,
    "",
    "Typical workflow: search_dataservices → get_dataservice_info →",
    "get_dataservice_openapi_spec → call the API using base_api_url per spec.",
  ].join("\n"),
  inputSchema: getDataserviceOpenapiSpecInputShape,
  outputSchema: getDataserviceOpenapiSpecOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const ds = await getDataserviceOrThrow(ctx.deps, input.dataservice_id);
    const title = ds.title || "Unknown";
    if (!ds.machineDocumentationUrl) {
      const message = `Third-party API '${title}' has no machine_documentation_url (dataservice catalog entry).${
        ds.baseApiUrl ? ` Base API URL is: ${ds.baseApiUrl}` : ""
      }`;
      return {
        text: message,
        structured: {
          dataservice_id: ds.id,
          title,
          base_api_url: ds.baseApiUrl,
          has_spec: false,
          message,
        },
      };
    }
    const spec = await ctx.deps.datagouv.fetchOpenApiSpec(ds.machineDocumentationUrl);
    const summary = summarizeSpec(spec);
    const header = [`OpenAPI spec for: ${title}`, `Source: ${ds.machineDocumentationUrl}`];
    if (ds.baseApiUrl) header.push(`Base API URL: ${ds.baseApiUrl}`);
    return {
      text: [...header, "", ...renderSpecSummary(summary)].join("\n"),
      structured: {
        dataservice_id: ds.id,
        title,
        source_url: ds.machineDocumentationUrl,
        base_api_url: ds.baseApiUrl,
        has_spec: true,
        api: {
          title: summary.title,
          version: summary.version,
          description: summary.description,
          servers: summary.servers,
          endpoints_total: summary.endpointsTotal,
          endpoints: summary.endpoints,
        },
      },
      howToGetMore: "Open the source URL for the full specification.",
    };
  },
});

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

/** Port of the legacy `_summarize_spec`: info, servers, endpoints + parameters. */
export function summarizeSpec(spec: Record<string, unknown>): SpecSummary {
  const info = asRecord(spec.info) ?? {};
  const servers: SpecSummary["servers"] = [];
  if (Array.isArray(spec.servers)) {
    for (const server of spec.servers.slice(0, MAX_SERVERS)) {
      const s = asRecord(server);
      const url = asString(s?.url);
      if (url) servers.push({ url, description: asString(s?.description) });
    }
  }
  // Swagger 2.0
  const host = asString(spec.host);
  if (host) {
    const scheme = (Array.isArray(spec.schemes) && asString(spec.schemes[0])) || "https";
    servers.push({
      url: `${scheme}://${host}${asString(spec.basePath) ?? ""}`,
      description: "Swagger 2.0 host",
    });
  }

  const endpoints: EndpointSummary[] = [];
  let endpointsTotal = 0;
  const paths = asRecord(spec.paths) ?? {};
  for (const [path, methods] of Object.entries(paths)) {
    const ops = asRecord(methods);
    if (!ops) continue;
    for (const [method, details] of Object.entries(ops)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const op = asRecord(details);
      if (!op) continue;
      endpointsTotal++;
      if (endpoints.length >= MAX_ENDPOINTS) continue;
      const rawSummary = asString(op.summary) ?? asString(op.description);
      const summary = rawSummary
        ? truncate(rawSummary.split("\n")[0] ?? "", SUMMARY_CHARS)
        : undefined;
      const parameters: EndpointSummary["parameters"] = [];
      if (Array.isArray(op.parameters)) {
        for (const p of op.parameters) {
          const param = asRecord(p);
          if (!param) continue;
          const schema = asRecord(param.schema);
          parameters.push({
            name: asString(param.name) ?? "?",
            location: asString(param.in) ?? "",
            type: asString(schema?.type) ?? asString(param.type) ?? "",
            required: param.required === true,
          });
        }
      }
      endpoints.push({ method: method.toUpperCase(), path, summary, parameters });
    }
  }

  const description = asString(info.description);
  return {
    title: asString(info.title),
    version: asString(info.version),
    description: description ? truncate(description, INFO_DESCRIPTION_CHARS) : undefined,
    servers,
    endpointsTotal,
    endpoints,
  };
}

export function renderSpecSummary(summary: SpecSummary): string[] {
  const out: string[] = [];
  if (summary.title) out.push(`API: ${summary.title}`);
  if (summary.version) out.push(`Version: ${summary.version}`);
  if (summary.description) out.push(`Description: ${summary.description}`);
  if (summary.servers.length > 0) {
    out.push("", "Servers:");
    for (const s of summary.servers)
      out.push(`  - ${s.url}${s.description ? ` (${s.description})` : ""}`);
  }
  if (summary.endpointsTotal > 0) {
    out.push("", `Endpoints (${summary.endpointsTotal} operations):`);
    for (const ep of summary.endpoints) {
      out.push(`  ${ep.method} ${ep.path}`);
      if (ep.summary) out.push(`    ${ep.summary}`);
      for (const p of ep.parameters) {
        out.push(`      - ${p.name} [${p.location}, ${p.type}]${p.required ? " (required)" : ""}`);
      }
    }
    if (summary.endpointsTotal > summary.endpoints.length) {
      out.push(
        `  … ${summary.endpointsTotal - summary.endpoints.length} more operation(s) omitted; see the source URL.`,
      );
    }
  } else {
    out.push("", "No endpoints found in the specification.");
  }
  return out;
}
