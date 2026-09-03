import { z } from "zod";
import { NotFoundError } from "../core/errors.js";
import { truncate } from "../core/text.js";
import type { DataserviceDetail } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { DETAIL_DESCRIPTION_CHARS, DETAIL_TAGS_MAX, kv, lines } from "./shared/formatters.js";
import { defineTool } from "./types.js";

export const LEGACY_DATASERVICE_NOT_FOUND = (id: string) =>
  `Error: Third-party API not found (dataservice_id='${id}').`;

export async function getDataserviceOrThrow(
  deps: ToolDeps,
  dataserviceId: string,
): Promise<DataserviceDetail> {
  try {
    return await deps.datagouv.getDataservice(dataserviceId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(LEGACY_DATASERVICE_NOT_FOUND(dataserviceId), {
        cause: error,
        details: { dataservice_id: dataserviceId },
        hint: "Find the right dataservice ID with search_dataservices.",
      });
    }
    throw error;
  }
}

export const getDataserviceInfoInputShape = {
  dataservice_id: z.string().min(1).describe("Dataservice (third-party API) ID or slug."),
};

export const dataserviceDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  base_api_url: z.string().optional(),
  machine_documentation_url: z.string().optional(),
  business_documentation_url: z.string().optional(),
  organization: z.string().optional(),
  organization_id: z.string().optional(),
  tags: z.array(z.string()),
  created_at: z.string().optional(),
  last_modified: z.string().optional(),
  license: z.string().optional(),
  availability: z.number().optional(),
  access_type: z.string().optional(),
  datasets_count: z.number().int(),
});

export const getDataserviceInfoTool = defineTool<typeof getDataserviceInfoInputShape, ToolDeps>({
  name: "get_dataservice_info",
  title: "Get third-party API info",
  legacy: true,
  description: [
    "Get detailed metadata about a specific third-party API (dataservice).",
    "",
    "Returns title, description, organization, base_api_url,",
    "machine_documentation_url (OpenAPI/Swagger spec), license, and dates.",
    "",
    "To use a third-party API: (1) get its info here, (2) fetch the OpenAPI spec",
    "via get_dataservice_openapi_spec, (3) call base_api_url per spec.",
  ].join("\n"),
  inputSchema: getDataserviceInfoInputShape,
  outputSchema: { dataservice: dataserviceDetailSchema },
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const ds = await getDataserviceOrThrow(ctx.deps, input.dataservice_id);
    return {
      text: formatDataservice(ds),
      structured: { dataservice: dataserviceDetailToStructured(ds) },
    };
  },
});

export function dataserviceDetailToStructured(ds: DataserviceDetail) {
  return {
    id: ds.id,
    title: ds.title,
    description: truncate(ds.description, DETAIL_DESCRIPTION_CHARS),
    url: ds.url,
    base_api_url: ds.baseApiUrl,
    machine_documentation_url: ds.machineDocumentationUrl,
    business_documentation_url: ds.businessDocumentationUrl,
    organization: ds.organization?.name,
    organization_id: ds.organization?.id,
    tags: ds.tags.slice(0, DETAIL_TAGS_MAX),
    created_at: ds.createdAt,
    last_modified: ds.lastModified,
    license: ds.license,
    availability: ds.availability,
    access_type: ds.accessType,
    datasets_count: ds.datasetsCount,
  };
}

export function formatDataservice(ds: DataserviceDetail): string {
  return lines(
    `Third-party API information: ${ds.title || "Unknown"}`,
    "",
    kv("ID", ds.id),
    kv("URL", ds.url),
    ds.description ? "" : undefined,
    ds.description ? `Description: ${truncate(ds.description, DETAIL_DESCRIPTION_CHARS)}` : undefined,
    "",
    kv("Base API URL", ds.baseApiUrl),
    kv("OpenAPI/Swagger spec", ds.machineDocumentationUrl),
    kv("Documentation", ds.businessDocumentationUrl),
    kv("Access type", ds.accessType),
    ds.availability !== undefined ? `Availability: ${ds.availability}%` : undefined,
    ds.organization ? "" : undefined,
    ds.organization ? `Organization: ${ds.organization.name}` : undefined,
    ds.organization ? `  Organization ID: ${ds.organization.id}` : undefined,
    ds.tags.length > 0 ? "" : undefined,
    kv("Tags", ds.tags.slice(0, DETAIL_TAGS_MAX)),
    ds.createdAt || ds.lastModified ? "" : undefined,
    kv("Created", ds.createdAt),
    kv("Last updated", ds.lastModified),
    ds.license ? "" : undefined,
    kv("License", ds.license),
    ds.datasetsCount > 0 ? "" : undefined,
    ds.datasetsCount > 0 ? `Related datasets: ${ds.datasetsCount}` : undefined,
  );
}
