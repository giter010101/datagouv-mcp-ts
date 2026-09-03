import { z } from "zod";
import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import { buildUrl, type HttpClient, type QueryParams } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import type { LicenseInfo, SiteInfo, SpatialLevel, SpatialZone } from "../core/types.js";
import { toLicenseInfo, toSchemaCatalogEntry, toSiteInfo } from "./mappers/entities.js";
import {
  apiBadgesSchema,
  apiLicenseSchema,
  apiRegisteredSchemaSchema,
  apiSiteSchema,
  apiSpatialLevelSchema,
  apiSpatialZoneSchema,
  apiSuggestDatasetSchema,
  apiSuggestOrganizationSchema,
  apiSuggestTextSchema,
} from "./schemas/datagouv-misc.js";
import type { DatagouvClient, SchemaCatalogEntry, Suggestion } from "./types.js";

/**
 * Reference data (licenses, badges, spatial levels, site figures, registered
 * schemas) and `/suggest/` autocomplete endpoints of udata API v1.
 * Split from `HttpDatagouvClient` to keep files small; same deps, same cache.
 */

export type DatagouvReference = Pick<
  DatagouvClient,
  | "suggest"
  | "suggestZones"
  | "suggestTags"
  | "suggestFormats"
  | "listSpatialLevels"
  | "listSpatialGranularities"
  | "listLicenses"
  | "listBadges"
  | "listRegisteredSchemas"
  | "getSite"
>;

export const SUGGEST_MAX_SIZE = 20;
const REFERENCE_TTL_MS = 60 * 60_000;
const SUGGEST_TTL_MS = 5 * 60_000;

export interface DatagouvReferenceDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

function clampSize(size: number | undefined, fallback: number): number {
  return Math.min(Math.max(1, Math.floor(size ?? fallback)), SUGGEST_MAX_SIZE);
}

export class HttpDatagouvReference implements DatagouvReference {
  private readonly log = childLogger("datagouv-reference");

  constructor(private readonly deps: DatagouvReferenceDeps) {}

  private url(path: string, query?: QueryParams): URL {
    return buildUrl(this.deps.baseUrls.datagouvApi, `1/${path}`, query);
  }

  private cachedJson<T>(key: string, url: URL, schema: z.ZodType<T>, ttlMs: number): Promise<T> {
    return this.deps.cache.getOrLoad(
      key,
      () => {
        this.log.debug({ url: url.href }, "reference request");
        return this.deps.http.getJson(url, { schema });
      },
      { ttlMs },
    );
  }

  /**
   * Aggregated autocomplete: datasets, organizations, tags and spatial zones are
   * queried in parallel; a failing source is dropped (logged) rather than failing
   * the whole suggestion.
   */
  async suggest(query: string, size?: number): Promise<Suggestion[]> {
    const q = query.trim();
    if (q === "") return [];
    const n = clampSize(size, 5);
    const site = this.deps.baseUrls.site;
    const sources: Array<Promise<Suggestion[]>> = [
      this.cachedJson(
        `datagouv:suggest:datasets:${q}:${n}`,
        this.url("datasets/suggest/", { q, size: n }),
        z.array(apiSuggestDatasetSchema),
        SUGGEST_TTL_MS,
      ).then((items) =>
        items.map((d) => ({
          id: d.id,
          text: d.title,
          kind: "dataset",
          url: d.page ?? new URL(`datasets/${d.slug ?? d.id}/`, site).href,
        })),
      ),
      this.cachedJson(
        `datagouv:suggest:organizations:${q}:${n}`,
        this.url("organizations/suggest/", { q, size: n }),
        z.array(apiSuggestOrganizationSchema),
        SUGGEST_TTL_MS,
      ).then((items) =>
        items.map((o) => ({
          id: o.id,
          text: o.name,
          kind: "organization",
          url: o.page ?? new URL(`organizations/${o.slug ?? o.id}/`, site).href,
        })),
      ),
      this.suggestTags(q, n).then((tags) =>
        tags.map((t) => ({ id: t, text: t, kind: "tag", url: undefined })),
      ),
      this.suggestZones(q, n).then((zones) =>
        zones.map((zone) => ({
          id: zone.id,
          text: `${zone.name} (${zone.level})`,
          kind: "zone",
          url: undefined,
        })),
      ),
    ];
    const settled = await Promise.allSettled(sources);
    const out: Suggestion[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") out.push(...result.value);
      else this.log.warn({ err: result.reason, query: q }, "suggest source failed");
    }
    return out;
  }

  async suggestZones(query: string, size?: number): Promise<SpatialZone[]> {
    const n = clampSize(size, 5);
    const items = await this.cachedJson(
      `datagouv:suggest:zones:${query}:${n}`,
      this.url("spatial/zones/suggest/", { q: query, size: n }),
      z.array(apiSpatialZoneSchema),
      SUGGEST_TTL_MS,
    );
    return items.map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      level: zone.level,
      uri: zone.uri ?? undefined,
    }));
  }

  async suggestTags(query: string, size?: number): Promise<string[]> {
    const n = clampSize(size, 5);
    const items = await this.cachedJson(
      `datagouv:suggest:tags:${query}:${n}`,
      this.url("tags/suggest/", { q: query, size: n }),
      z.array(apiSuggestTextSchema),
      SUGGEST_TTL_MS,
    );
    return items.map((t) => t.text);
  }

  async suggestFormats(query: string, size?: number): Promise<string[]> {
    const n = clampSize(size, 10);
    const items = await this.cachedJson(
      `datagouv:suggest:formats:${query}:${n}`,
      this.url("datasets/suggest/formats/", { q: query, size: n }),
      z.array(apiSuggestTextSchema),
      SUGGEST_TTL_MS,
    );
    return items.map((t) => t.text);
  }

  async listSpatialLevels(): Promise<SpatialLevel[]> {
    const items = await this.cachedJson(
      "datagouv:spatial-levels",
      this.url("spatial/levels/"),
      z.array(apiSpatialLevelSchema),
      REFERENCE_TTL_MS,
    );
    return items.map((l) => ({ id: l.id, name: l.name }));
  }

  async listSpatialGranularities(): Promise<SpatialLevel[]> {
    const items = await this.cachedJson(
      "datagouv:spatial-granularities",
      this.url("spatial/granularities/"),
      z.array(apiSpatialLevelSchema),
      REFERENCE_TTL_MS,
    );
    return items.map((l) => ({ id: l.id, name: l.name }));
  }

  async listLicenses(): Promise<LicenseInfo[]> {
    const items = await this.cachedJson(
      "datagouv:licenses",
      this.url("datasets/licenses/"),
      z.array(apiLicenseSchema),
      REFERENCE_TTL_MS,
    );
    return items.map(toLicenseInfo);
  }

  listBadges(): Promise<Record<string, string>> {
    return this.cachedJson(
      "datagouv:badges",
      this.url("datasets/badges/"),
      apiBadgesSchema,
      REFERENCE_TTL_MS,
    );
  }

  async listRegisteredSchemas(): Promise<SchemaCatalogEntry[]> {
    const items = await this.cachedJson(
      "datagouv:registered-schemas",
      this.url("datasets/schemas/"),
      z.array(apiRegisteredSchemaSchema),
      REFERENCE_TTL_MS,
    );
    return items.map(toSchemaCatalogEntry);
  }

  async getSite(): Promise<SiteInfo> {
    const body = await this.cachedJson(
      "datagouv:site",
      this.url("site/"),
      apiSiteSchema,
      SUGGEST_TTL_MS,
    );
    return toSiteInfo(body);
  }
}
