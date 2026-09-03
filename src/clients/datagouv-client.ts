import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import { buildUrl, type HttpClient } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import { truncate } from "../core/text.js";
import type { DatasetSummary, OrganizationRef, Page } from "../core/types.js";
import {
  type ApiDatasetSearchItem,
  apiDatasetSearchResponseSchema,
} from "./schemas/datagouv-search.js";
import type { DatagouvClient, SearchDatasetsParams } from "./types.js";

export const DATASET_SEARCH_MAX_PAGE_SIZE = 100;
const SEARCH_CACHE_TTL_MS = 60_000;

export interface DatagouvClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

/**
 * Methods of `DatagouvClient` implemented so far. Workstream A widens
 * `HttpDatagouvClient` to the full `DatagouvClient` contract.
 */
export type DatagouvSearchClient = Pick<DatagouvClient, "searchDatasets">;

export class HttpDatagouvClient implements DatagouvSearchClient {
  private readonly log = childLogger("datagouv-client");

  constructor(private readonly deps: DatagouvClientDeps) {}

  async searchDatasets(params: SearchDatasetsParams): Promise<Page<DatasetSummary>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), DATASET_SEARCH_MAX_PAGE_SIZE);
    const url = buildUrl(this.deps.baseUrls.datagouvApi, "2/datasets/search/", {
      q: params.query,
      page,
      page_size: pageSize,
      sort: params.sort,
      last_update_range: params.lastUpdateRange,
      organization: params.filters?.organization,
      tag: params.filters?.tag?.join(","),
      license: params.filters?.license,
      format: params.filters?.format,
      badge: params.filters?.badge,
      geozone: params.filters?.geozone,
      granularity: params.filters?.granularity,
      schema: params.filters?.schema,
      topic: params.filters?.topic,
    });

    const cacheKey = `datagouv:search-datasets:${url.search}`;
    return this.deps.cache.getOrLoad(
      cacheKey,
      async () => {
        this.log.debug({ url: url.href }, "search datasets");
        const body = await this.deps.http.getJson(url, { schema: apiDatasetSearchResponseSchema });
        const items = body.data.map((item) => this.toDatasetSummary(item));
        const total = body.total ?? items.length;
        return {
          items,
          page,
          pageSize,
          total,
          hasNext: body.next_page != null || page * pageSize < total,
        };
      },
      { ttlMs: SEARCH_CACHE_TTL_MS },
    );
  }

  private toDatasetSummary(item: ApiDatasetSearchItem): DatasetSummary {
    const slug = item.slug || item.id;
    return {
      id: item.id,
      slug,
      title: item.title,
      // Live API v2 search returns `description_short: null`; derive it from the markdown description.
      descriptionShort: item.description_short || summarizeDescription(item.description),
      organization: this.toOrganizationRef(item.organization),
      tags: item.tags ?? [],
      resourcesCount: item.resources?.total ?? 0,
      lastUpdate: item.last_update ?? undefined,
      license: item.license ?? undefined,
      url: new URL(`datasets/${slug}/`, this.deps.baseUrls.site).href,
    };
  }

  private toOrganizationRef(
    org: ApiDatasetSearchItem["organization"],
  ): OrganizationRef | undefined {
    if (!org) return undefined;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug ?? undefined,
      url:
        org.page ?? new URL(`organizations/${org.slug ?? org.id}/`, this.deps.baseUrls.site).href,
    };
  }
}

const SHORT_DESCRIPTION_CHARS = 300;

/** First paragraph of a markdown description, flattened and bounded. */
export function summarizeDescription(description: string | null | undefined): string {
  if (!description) return "";
  const flattened = description
    .replace(/[#*_`>]+/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(flattened, SHORT_DESCRIPTION_CHARS);
}

export function createDatagouvClient(deps: DatagouvClientDeps): HttpDatagouvClient {
  return new HttpDatagouvClient(deps);
}
