import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import { buildUrl, type HttpClient, type QueryParams } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import type {
  DataserviceDetail,
  DataserviceSummary,
  DatasetDetail,
  DatasetSummary,
  LicenseInfo,
  OrganizationDetail,
  OrganizationSummary,
  Page,
  ResourceDetail,
  ReuseDetail,
  ReuseSummary,
  SiteInfo,
  SpatialLevel,
  SpatialZone,
  TopicDetail,
  TopicElement,
  TopicSummary,
} from "../core/types.js";
import { type DatagouvReference, HttpDatagouvReference } from "./datagouv-reference.js";
import { toDatasetDetail, toDatasetSummary, toResourceDetail } from "./mappers/dataset.js";
import {
  toDataserviceDetail,
  toDataserviceSummary,
  toOrganizationDetail,
  toOrganizationSummary,
  toReuseDetail,
  toReuseSummary,
  toTopicDetail,
  toTopicElement,
  toTopicSummary,
} from "./mappers/entities.js";
import { parseOpenApiDocument } from "./openapi.js";
import {
  apiDatasetDetailSchema,
  apiResourceEnvelopeSchema,
  apiResourcesPageSchema,
} from "./schemas/datagouv-dataset.js";
import {
  apiDataserviceSchema,
  apiOrganizationSchema,
  apiPageSchema,
  apiReuseSchema,
  apiTopicElementSchema,
  apiTopicSchema,
} from "./schemas/datagouv-misc.js";
import { apiDatasetSearchResponseSchema } from "./schemas/datagouv-search.js";
import type {
  DatagouvClient,
  DatasetSearchFacets,
  ListReusesParams,
  SchemaCatalogEntry,
  SearchDataservicesParams,
  SearchDatasetsParams,
  SearchOrganizationsParams,
  Suggestion,
} from "./types.js";

export const DATASET_SEARCH_MAX_PAGE_SIZE = 100;
/** udata list endpoints accept up to 1000 but v2 `/resources/` is documented at 50 by default; 200 is safe. */
export const RESOURCES_MAX_PAGE_SIZE = 200;
export const TTL = {
  search: 60_000,
  detail: 5 * 60_000,
  reference: 60 * 60_000,
} as const;

export interface DatagouvClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

export function clampPage(page: number | undefined): number {
  return Math.max(1, Math.floor(page ?? 1));
}

export function clampPageSize(pageSize: number | undefined, max: number, fallback = 20): number {
  return Math.min(Math.max(1, Math.floor(pageSize ?? fallback)), max);
}

interface RawPage {
  page?: number | null | undefined;
  page_size?: number | null | undefined;
  total?: number | null | undefined;
  next_page?: string | null | undefined;
}

export function toPage<T>(raw: RawPage, items: T[], page: number, pageSize: number): Page<T> {
  const total = raw.total ?? items.length;
  return {
    items,
    page: raw.page ?? page,
    pageSize: raw.page_size ?? pageSize,
    total,
    hasNext: raw.next_page != null || page * pageSize < total,
  };
}

export class HttpDatagouvClient implements DatagouvClient {
  private readonly log = childLogger("datagouv-client");
  private readonly reference: DatagouvReference;

  constructor(private readonly deps: DatagouvClientDeps) {
    this.reference = new HttpDatagouvReference(deps);
  }

  private get site(): string {
    return this.deps.baseUrls.site;
  }

  private url(path: string, query?: QueryParams): URL {
    return buildUrl(this.deps.baseUrls.datagouvApi, path, query);
  }

  private cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    return this.deps.cache.getOrLoad(key, loader, { ttlMs });
  }

  // ---------------------------------------------------------------- datasets

  async searchDatasets(params: SearchDatasetsParams): Promise<Page<DatasetSummary>> {
    const { facets: _facets, ...page } = await this.searchDatasetsWithFacets(params);
    return page;
  }

  async searchDatasetsWithFacets(
    params: SearchDatasetsParams,
  ): Promise<Page<DatasetSummary> & { facets: DatasetSearchFacets }> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize, DATASET_SEARCH_MAX_PAGE_SIZE);
    const f = params.filters;
    const url = this.url("2/datasets/search/", {
      q: params.query,
      page,
      page_size: pageSize,
      sort: params.sort,
      last_update_range: params.lastUpdateRange,
      organization: f?.organization,
      tag: f?.tag?.join(","),
      license: f?.license,
      format: f?.format,
      badge: f?.badge,
      geozone: f?.geozone,
      granularity: f?.granularity,
      schema: f?.schema,
      topic: f?.topic,
    });
    return this.cached(`datagouv:search-datasets:${url.search}`, TTL.search, async () => {
      this.log.debug({ url: url.href }, "search datasets");
      const body = await this.deps.http.getJson(url, { schema: apiDatasetSearchResponseSchema });
      const items = body.data.map((item) => toDatasetSummary(item, this.site));
      return { ...toPage(body, items, page, pageSize), facets: normalizeFacets(body.facets) };
    });
  }

  listHighValueDatasets(
    query = "",
    page?: number,
    pageSize?: number,
  ): Promise<Page<DatasetSummary>> {
    return this.searchDatasets({ query, page, pageSize, filters: { badge: "hvd" } });
  }

  getDataset(datasetIdOrSlug: string): Promise<DatasetDetail> {
    const url = this.url(`1/datasets/${encodeURIComponent(datasetIdOrSlug)}/`);
    return this.cached(`datagouv:dataset:${datasetIdOrSlug}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiDatasetDetailSchema,
        notFoundMessage: `Dataset with ID '${datasetIdOrSlug}' not found.`,
      });
      return toDatasetDetail(body, this.site, this.deps.baseUrls.datagouvApi);
    });
  }

  getResource(resourceId: string): Promise<ResourceDetail> {
    const url = this.url(`2/datasets/resources/${encodeURIComponent(resourceId)}/`);
    return this.cached(`datagouv:resource:${resourceId}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiResourceEnvelopeSchema,
        notFoundMessage: `Resource with ID '${resourceId}' not found.`,
      });
      return toResourceDetail(body.resource, body.dataset_id ?? "", this.deps.baseUrls.datagouvApi);
    });
  }

  listDatasetResources(
    datasetId: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<ResourceDetail>> {
    const p = clampPage(page);
    const size = clampPageSize(pageSize, RESOURCES_MAX_PAGE_SIZE, 50);
    const url = this.url(`2/datasets/${encodeURIComponent(datasetId)}/resources/`, {
      page: p,
      page_size: size,
    });
    return this.cached(
      `datagouv:dataset-resources:${datasetId}:${url.search}`,
      TTL.detail,
      async () => {
        const body = await this.deps.http.getJson(url, {
          schema: apiResourcesPageSchema,
          notFoundMessage: `Dataset with ID '${datasetId}' not found.`,
        });
        const items = body.data.map((r) =>
          toResourceDetail(r, datasetId, this.deps.baseUrls.datagouvApi),
        );
        return toPage(body, items, p, size);
      },
    );
  }

  // ----------------------------------------------------------- organizations

  searchOrganizations(params: SearchOrganizationsParams): Promise<Page<OrganizationSummary>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize, DATASET_SEARCH_MAX_PAGE_SIZE);
    const url = this.url("2/organizations/search/", {
      q: params.query,
      page,
      page_size: pageSize,
      sort: params.sort,
      badge: params.badge,
      name: params.name,
      business_number_id: params.businessNumberId,
    });
    return this.cached(`datagouv:search-organizations:${url.search}`, TTL.search, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiPageSchema(apiOrganizationSchema),
      });
      return toPage(
        body,
        body.data.map((o) => toOrganizationSummary(o, this.site)),
        page,
        pageSize,
      );
    });
  }

  getOrganization(organizationIdOrSlug: string): Promise<OrganizationDetail> {
    const url = this.url(`1/organizations/${encodeURIComponent(organizationIdOrSlug)}/`);
    return this.cached(`datagouv:organization:${organizationIdOrSlug}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiOrganizationSchema,
        notFoundMessage: `Organization with ID '${organizationIdOrSlug}' not found.`,
      });
      return toOrganizationDetail(body, this.site);
    });
  }

  // ------------------------------------------------------------ dataservices

  searchDataservices(params: SearchDataservicesParams): Promise<Page<DataserviceSummary>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize, DATASET_SEARCH_MAX_PAGE_SIZE);
    const url = this.url("2/dataservices/search/", { q: params.query, page, page_size: pageSize });
    return this.cached(`datagouv:search-dataservices:${url.search}`, TTL.search, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiPageSchema(apiDataserviceSchema),
      });
      return toPage(
        body,
        body.data.map((d) => toDataserviceSummary(d, this.site)),
        page,
        pageSize,
      );
    });
  }

  getDataservice(dataserviceId: string): Promise<DataserviceDetail> {
    const url = this.url(`1/dataservices/${encodeURIComponent(dataserviceId)}/`);
    return this.cached(`datagouv:dataservice:${dataserviceId}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiDataserviceSchema,
        notFoundMessage: `Dataservice with ID '${dataserviceId}' not found.`,
      });
      return toDataserviceDetail(body, this.site);
    });
  }

  // ------------------------------------------------------------------ reuses

  listReuses(params: ListReusesParams): Promise<Page<ReuseSummary>> {
    const page = clampPage(params.page);
    const pageSize = clampPageSize(params.pageSize, DATASET_SEARCH_MAX_PAGE_SIZE);
    const url = this.url("1/reuses/", {
      q: params.query,
      dataset: params.datasetId,
      organization: params.organizationId,
      type: params.type,
      topic: params.topic,
      sort: params.sort,
      page,
      page_size: pageSize,
    });
    return this.cached(`datagouv:reuses:${url.search}`, TTL.search, async () => {
      const body = await this.deps.http.getJson(url, { schema: apiPageSchema(apiReuseSchema) });
      return toPage(
        body,
        body.data.map((r) => toReuseSummary(r, this.site)),
        page,
        pageSize,
      );
    });
  }

  getReuse(reuseIdOrSlug: string): Promise<ReuseDetail> {
    const url = this.url(`1/reuses/${encodeURIComponent(reuseIdOrSlug)}/`);
    return this.cached(`datagouv:reuse:${reuseIdOrSlug}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiReuseSchema,
        notFoundMessage: `Reuse with ID '${reuseIdOrSlug}' not found.`,
      });
      return toReuseDetail(body, this.site);
    });
  }

  // ------------------------------------------------------------------ topics

  searchTopics(query: string, page?: number, pageSize?: number): Promise<Page<TopicSummary>> {
    const p = clampPage(page);
    const size = clampPageSize(pageSize, DATASET_SEARCH_MAX_PAGE_SIZE);
    const url = this.url("2/topics/search/", { q: query, page: p, page_size: size });
    return this.cached(`datagouv:search-topics:${url.search}`, TTL.search, async () => {
      const body = await this.deps.http.getJson(url, { schema: apiPageSchema(apiTopicSchema) });
      return toPage(
        body,
        body.data.map((t) => toTopicSummary(t, this.site)),
        p,
        size,
      );
    });
  }

  async getTopic(topicIdOrSlug: string): Promise<TopicDetail & { elements: TopicElement[] }> {
    const url = this.url(`2/topics/${encodeURIComponent(topicIdOrSlug)}/`);
    const detail = await this.cached(`datagouv:topic:${topicIdOrSlug}`, TTL.detail, async () => {
      const body = await this.deps.http.getJson(url, {
        schema: apiTopicSchema,
        notFoundMessage: `Topic with ID '${topicIdOrSlug}' not found.`,
      });
      return toTopicDetail(body, this.site);
    });
    const elements =
      detail.elementsCount > 0 ? (await this.listTopicElements(detail.id, 1, 50)).items : [];
    return { ...detail, elements };
  }

  listTopicElements(
    topicIdOrSlug: string,
    page?: number,
    pageSize?: number,
  ): Promise<Page<TopicElement>> {
    const p = clampPage(page);
    const size = clampPageSize(pageSize, DATASET_SEARCH_MAX_PAGE_SIZE, 20);
    const url = this.url(`2/topics/${encodeURIComponent(topicIdOrSlug)}/elements/`, {
      page: p,
      page_size: size,
    });
    return this.cached(
      `datagouv:topic-elements:${topicIdOrSlug}:${url.search}`,
      TTL.detail,
      async () => {
        const body = await this.deps.http.getJson(url, {
          schema: apiPageSchema(apiTopicElementSchema),
          notFoundMessage: `Topic with ID '${topicIdOrSlug}' not found.`,
        });
        return toPage(
          body,
          body.data.map((e) => toTopicElement(e, this.site)),
          p,
          size,
        );
      },
    );
  }

  // --------------------------------------------------- reference & suggest

  suggest(query: string, size?: number): Promise<Suggestion[]> {
    return this.reference.suggest(query, size);
  }
  suggestZones(query: string, size?: number): Promise<SpatialZone[]> {
    return this.reference.suggestZones(query, size);
  }
  suggestTags(query: string, size?: number): Promise<string[]> {
    return this.reference.suggestTags(query, size);
  }
  suggestFormats(query: string, size?: number): Promise<string[]> {
    return this.reference.suggestFormats(query, size);
  }
  listSpatialLevels(): Promise<SpatialLevel[]> {
    return this.reference.listSpatialLevels();
  }
  listSpatialGranularities(): Promise<SpatialLevel[]> {
    return this.reference.listSpatialGranularities();
  }
  listLicenses(): Promise<LicenseInfo[]> {
    return this.reference.listLicenses();
  }
  listBadges(): Promise<Record<string, string>> {
    return this.reference.listBadges();
  }
  listRegisteredSchemas(): Promise<SchemaCatalogEntry[]> {
    return this.reference.listRegisteredSchemas();
  }
  getSite(): Promise<SiteInfo> {
    return this.reference.getSite();
  }

  // ----------------------------------------------------------------- openapi

  fetchOpenApiSpec(url: string): Promise<Record<string, unknown>> {
    return this.cached(`datagouv:openapi:${url}`, TTL.reference, async () => {
      const text = await this.deps.http.getText(url, {
        headers: { accept: "application/json, application/yaml, text/yaml, text/plain, */*" },
      });
      return parseOpenApiDocument(text, url);
    });
  }
}

/** udata facets come as `[{ name, count }]` buckets; older shapes used `[value, count]` tuples. */
export function normalizeFacets(
  raw: Record<string, unknown> | null | undefined,
): DatasetSearchFacets {
  const out: DatasetSearchFacets = {};
  for (const [facet, buckets] of Object.entries(raw ?? {})) {
    if (!Array.isArray(buckets)) continue;
    out[facet] = buckets.flatMap((bucket) => {
      if (Array.isArray(bucket) && typeof bucket[0] === "string" && typeof bucket[1] === "number") {
        return [{ value: bucket[0], count: bucket[1] }];
      }
      if (bucket !== null && typeof bucket === "object") {
        const b = bucket as Record<string, unknown>;
        const value =
          typeof b.name === "string" ? b.name : typeof b.value === "string" ? b.value : undefined;
        if (value !== undefined && typeof b.count === "number") return [{ value, count: b.count }];
      }
      return [];
    });
  }
  return out;
}

/** @deprecated Kept for `server/deps.ts` until workstream C widens `ServerDeps` to `Clients` (TD-001). */
export type DatagouvSearchClient = Pick<DatagouvClient, "searchDatasets">;

export { summarizeDescription } from "./mappers/text.js";

export function createDatagouvClient(deps: DatagouvClientDeps): HttpDatagouvClient {
  return new HttpDatagouvClient(deps);
}
