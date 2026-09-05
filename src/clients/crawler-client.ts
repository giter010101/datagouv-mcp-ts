import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import { buildUrl, type HttpClient } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import { crawlerExceptionsSchema, crawlerHealthSchema } from "./schemas/crawler.js";
import type { CrawlerClient, CrawlerHealth } from "./types.js";

export const CRAWLER_EXCEPTIONS_TTL_MS = 60 * 60_000;
const HEALTH_TTL_MS = 60_000;
/** The exceptions list is ~500 kB; give it more room than the default request timeout. */
const EXCEPTIONS_TIMEOUT_MS = 30_000;

export interface CrawlerClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

/**
 * Hydra crawler API. The exceptions list (resources above the Tabular API size
 * limits that are nevertheless loaded) is cached 1 h and served stale when the
 * upstream fails; when nothing is cached yet, failures degrade to an empty set
 * (legacy behaviour) so capability detection never breaks on the crawler.
 */
export class HttpCrawlerClient implements CrawlerClient {
  private readonly log = childLogger("crawler-client");

  constructor(private readonly deps: CrawlerClientDeps) {}

  async getResourceExceptions(): Promise<ReadonlySet<string>> {
    const url = buildUrl(this.deps.baseUrls.crawlerApi, "resources-exceptions");
    try {
      return await this.deps.cache.getOrLoad(
        "crawler:exceptions",
        async () => {
          this.log.debug({ url: url.href }, "fetch resource exceptions");
          const body = await this.deps.http.getJson(url, {
            schema: crawlerExceptionsSchema,
            timeoutMs: EXCEPTIONS_TIMEOUT_MS,
          });
          const ids = new Set<string>();
          for (const item of body) if (item.resource_id) ids.add(item.resource_id);
          return ids as ReadonlySet<string>;
        },
        { ttlMs: CRAWLER_EXCEPTIONS_TTL_MS, staleOnError: true },
      );
    } catch (error) {
      this.log.warn({ err: error }, "crawler exceptions unavailable; assuming none");
      return new Set<string>();
    }
  }

  async isException(resourceId: string): Promise<boolean> {
    return (await this.getResourceExceptions()).has(resourceId);
  }

  getHealth(): Promise<CrawlerHealth> {
    const url = buildUrl(this.deps.baseUrls.crawlerApi, "health");
    return this.deps.cache.getOrLoad(
      "crawler:health",
      async () => {
        const body = await this.deps.http.getJson(url, { schema: crawlerHealthSchema });
        const features: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(body)) {
          if (typeof value === "boolean") features[key] = value;
        }
        return {
          version: body.version ?? undefined,
          environment: body.environment ?? undefined,
          features,
        };
      },
      { ttlMs: HEALTH_TTL_MS },
    );
  }
}

export function createCrawlerClient(deps: CrawlerClientDeps): CrawlerClient {
  return new HttpCrawlerClient(deps);
}
