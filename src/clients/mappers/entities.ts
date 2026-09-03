import type {
  DataserviceDetail,
  DataserviceSummary,
  LicenseInfo,
  OrganizationDetail,
  OrganizationSummary,
  ReuseDetail,
  ReuseSummary,
  SiteInfo,
  TopicDetail,
  TopicElement,
  TopicSummary,
} from "../../core/types.js";
import type {
  ApiDataservice,
  ApiOrganization,
  ApiRegisteredSchema,
  ApiReuse,
  ApiTopic,
  ApiTopicElement,
} from "../schemas/datagouv-misc.js";
import type { SchemaCatalogEntry } from "../types.js";
import { toOrganizationRef } from "./dataset.js";
import { asNumber } from "./text.js";

export function toOrganizationSummary(raw: ApiOrganization, site: string): OrganizationSummary {
  const metrics = raw.metrics ?? {};
  const picked: NonNullable<OrganizationSummary["metrics"]> = {};
  for (const key of ["datasets", "reuses", "followers", "views"] as const) {
    const value = asNumber(metrics[key]);
    if (value !== undefined) picked[key] = value;
  }
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || raw.id,
    acronym: raw.acronym ?? undefined,
    badges: (raw.badges ?? []).map((b) => b.kind),
    metrics: Object.keys(picked).length > 0 ? picked : undefined,
    url: raw.page ?? new URL(`organizations/${raw.slug || raw.id}/`, site).href,
  };
}

export function toOrganizationDetail(raw: ApiOrganization, site: string): OrganizationDetail {
  return {
    ...toOrganizationSummary(raw, site),
    description: raw.description ?? "",
    businessNumberId: raw.business_number_id ?? undefined,
    createdAt: raw.created_at ?? undefined,
    logo: raw.logo ?? undefined,
  };
}

export function toDataserviceSummary(raw: ApiDataservice, site: string): DataserviceSummary {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    organization: toOrganizationRef(raw.organization, site),
    baseApiUrl: raw.base_api_url ?? undefined,
    machineDocumentationUrl: raw.machine_documentation_url ?? undefined,
    tags: raw.tags ?? [],
    url: raw.self_web_url ?? new URL(`dataservices/${raw.slug ?? raw.id}/`, site).href,
  };
}

export function toDataserviceDetail(raw: ApiDataservice, site: string): DataserviceDetail {
  return {
    ...toDataserviceSummary(raw, site),
    businessDocumentationUrl:
      raw.business_documentation_url ?? raw.technical_documentation_url ?? undefined,
    license: raw.license ?? undefined,
    availability: raw.availability ?? undefined,
    accessType: raw.access_type ?? undefined,
    createdAt: raw.created_at ?? undefined,
    lastModified: raw.metadata_modified_at ?? undefined,
    datasetsCount: countOrLength(raw.datasets),
  };
}

function countOrLength(
  value: unknown[] | { total?: number | null | undefined } | null | undefined,
): number {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  return value.total ?? 0;
}

export function toReuseSummary(raw: ApiReuse, site: string): ReuseSummary {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug || raw.id,
    type: raw.type ?? undefined,
    topic: raw.topic ?? undefined,
    organization: toOrganizationRef(raw.organization, site),
    datasetsCount: raw.datasets?.length ?? 0,
    url: raw.page ?? new URL(`reuses/${raw.slug || raw.id}/`, site).href,
  };
}

export function toReuseDetail(raw: ApiReuse, site: string): ReuseDetail {
  const owner = raw.owner;
  return {
    ...toReuseSummary(raw, site),
    description: raw.description ?? "",
    tags: raw.tags ?? [],
    datasets: (raw.datasets ?? []).map((d) => ({ id: d.id, title: d.title ?? "" })),
    createdAt: raw.created_at ?? undefined,
    lastModified: raw.last_modified ?? undefined,
    owner: owner
      ? {
          id: owner.id,
          name: [owner.first_name, owner.last_name].filter(Boolean).join(" "),
          slug: owner.slug ?? undefined,
          url: owner.page ?? undefined,
        }
      : undefined,
  };
}

export function toTopicSummary(raw: ApiTopic, site: string): TopicSummary {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || raw.id,
    description: raw.description ?? "",
    tags: raw.tags ?? [],
    url: new URL(`topics/${raw.slug || raw.id}/`, site).href,
  };
}

export function toTopicDetail(raw: ApiTopic, site: string): TopicDetail {
  return {
    ...toTopicSummary(raw, site),
    organization: toOrganizationRef(raw.organization, site),
    createdAt: raw.created_at ?? undefined,
    lastModified: raw.last_modified ?? undefined,
    elementsCount: countOrLength(raw.elements),
    featured: raw.featured ?? false,
  };
}

const ELEMENT_PATHS: Record<string, string> = {
  dataset: "datasets",
  reuse: "reuses",
  dataservice: "dataservices",
};

export function toTopicElement(raw: ApiTopicElement, site: string): TopicElement {
  const elementClass = raw.element?.class ?? undefined;
  const elementId = raw.element?.id ?? undefined;
  const path = elementClass ? ELEMENT_PATHS[elementClass.toLowerCase()] : undefined;
  return {
    id: raw.id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    tags: raw.tags ?? [],
    elementClass,
    elementId,
    url: path && elementId ? new URL(`${path}/${elementId}/`, site).href : undefined,
  };
}

export function toLicenseInfo(raw: {
  id: string;
  title: string;
  url?: string | null;
  flags?: string[] | null;
  alternate_urls?: string[] | null;
}): LicenseInfo {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url ?? undefined,
    flags: raw.flags ?? [],
    alternateUrls: raw.alternate_urls ?? [],
  };
}

export function toSiteInfo(raw: {
  id: string;
  title: string;
  version?: string | null;
  metrics?: Record<string, unknown> | null;
}): SiteInfo {
  const metrics: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.metrics ?? {})) {
    const n = asNumber(value);
    if (n !== undefined) metrics[key] = n;
  }
  return { id: raw.id, title: raw.title, version: raw.version ?? undefined, metrics };
}

/** Shared by data.gouv.fr `/datasets/schemas/` and schema.data.gouv.fr `schemas.json` (same shape). */
export function toSchemaCatalogEntry(raw: ApiRegisteredSchema): SchemaCatalogEntry {
  const type = raw.schema_type ?? "other";
  const versions = (raw.versions ?? []).map((v) => v.version_name);
  return {
    name: raw.name,
    title: raw.title,
    description: raw.description ?? "",
    schemaType: type === "tableschema" || type === "jsonschema" ? type : "other",
    schemaUrl: raw.schema_url,
    latestVersion: versions.at(-1),
    versions,
    homepage: raw.homepage ?? undefined,
    consolidationDatasetId: raw.consolidation_dataset_id ?? undefined,
  };
}
