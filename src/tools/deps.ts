import type { Clients, DatagouvClient } from "../clients/types.js";
import type { Config } from "../core/config.js";
import type { HttpClient } from "../core/http.js";
import type { OrganizationRef, ReuseSummary } from "../core/types.js";
import type { AccessorRegistry } from "../formats/registry.js";
import type { CapabilityDetector, QueryEngine } from "../formats/types.js";

/**
 * Everything the tools layer may depend on. Composed once in `server/deps.ts`
 * (real clients + formats) and by tests (fakes). Tools never reach for `fetch`.
 */

/** Formats-layer entry points consumed by tools (implemented by workstream B). */
export interface FormatsDeps {
  registry: AccessorRegistry;
  detectCapability: CapabilityDetector;
  /** Optional analytical engine (DuckDB behind `ENABLE_DUCKDB`); `undefined` when unavailable. */
  engine: QueryEngine | undefined;
}

export interface ReuseDetail extends ReuseSummary {
  description: string;
  tags: string[];
  datasets: Array<{ id: string; title: string }>;
  createdAt: string | undefined;
  lastModified: string | undefined;
  owner: OrganizationRef | undefined;
}

/**
 * Methods the tools layer would like on `DatagouvClient` but that are not yet
 * part of the shared contract. They are optional: tools degrade gracefully with
 * an actionable error when the client does not provide them.
 */
export interface DatagouvClientExtensions {
  getReuse(reuseIdOrSlug: string): Promise<ReuseDetail>;
}

export interface ToolDeps extends Clients {
  datagouv: DatagouvClient & Partial<DatagouvClientExtensions>;
  formats: FormatsDeps;
  config: Config;
  /** Only for cheap HEAD probes (`check_resource_availability`); never for parsing bodies. */
  http: HttpClient;
}
