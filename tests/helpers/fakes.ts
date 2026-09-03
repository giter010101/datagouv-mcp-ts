import type {
  Clients,
  CrawlerClient,
  DatagouvClient,
  MetricsClient,
  SchemaClient,
  Suggestion,
  TabularClient,
  TabularPage,
} from "../../src/clients/types.js";
import { NotFoundError, UnsupportedCapabilityError } from "../../src/core/errors.js";
import type {
  DataserviceDetail,
  DatasetDetail,
  DatasetSummary,
  OrganizationSummary,
  Page,
  ResourceDetail,
  ReuseSummary,
  Row,
  TableSchema,
  TableSlice,
  TopicSummary,
} from "../../src/core/types.js";
import { type AccessorRegistry, createAccessorRegistry } from "../../src/formats/registry.js";
import type {
  AccessContext,
  CapabilityDetector,
  CapabilityReport,
  PreviewResult,
  QueryEngine,
  QuerySpec,
  ResourceAccessor,
  ResourceCapability,
} from "../../src/formats/types.js";

/**
 * Fakes for the shared contracts, so workstreams can unit-test against
 * `Clients` / formats without the network or each other's code.
 *
 * Every fake is a plain object built by a factory that accepts partial
 * overrides. Unspecified methods return deterministic, minimal data (or throw
 * `NotFoundError` where an id is unknown). All fakes record their calls.
 *
 * ```ts
 * const clients = fakeClients({
 *   datagouv: { getDataset: async (id) => fakeDatasetDetail({ id }) },
 * });
 * const formats = fakeFormatsDeps({ report: { primary: "tabular_api" } });
 * ```
 */

export interface CallRecord {
  method: string;
  args: unknown[];
}

function recording<T extends object>(target: T, calls: CallRecord[], prefix: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string") return value;
      return (...args: unknown[]) => {
        calls.push({ method: `${prefix}.${prop}`, args });
        return (value as (...a: unknown[]) => unknown).apply(obj, args);
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Entity builders                                                     */
/* ------------------------------------------------------------------ */

export const FAKE_IDS = {
  dataset: "53699d0ea3a729239d205b2e",
  datasetSlug: "population",
  resourceTabularCsv: "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  resourceLargeCsv: "52200d61-5e80-4a4e-999f-6e1c184fa122",
  resourceXlsx: "45f3844f-0039-48ec-ade7-7dc8c429168b",
  resourceDeadRemote: "4792c248-8b80-4524-8605-7d4213e49051",
  resourceParquet: "84719f62-cdd4-4d7c-b292-2aafa56c6043",
  resourceGeojson: "7c257c68-14ec-495e-9823-99d30ccab111",
  organization: "534fff75a3a7292c64a77de4",
  dataservice: "672cf67802ef6b1be63b8975",
} as const;

export function fakePage<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return {
    items,
    page: 1,
    pageSize: Math.max(items.length, 1),
    total: items.length,
    hasNext: false,
    ...overrides,
  };
}

export function fakeDatasetSummary(overrides: Partial<DatasetSummary> = {}): DatasetSummary {
  return {
    id: FAKE_IDS.dataset,
    slug: FAKE_IDS.datasetSlug,
    title: "Population",
    descriptionShort: "Recensement de la population.",
    organization: {
      id: "534fff81a3a7292c64a77e5c",
      name: "Insee",
      slug: "insee",
      url: "https://www.data.gouv.fr/organizations/insee/",
    },
    tags: ["population", "insee"],
    resourcesCount: 2,
    lastUpdate: "2026-01-15T08:30:00+00:00",
    license: "fr-lo",
    url: "https://www.data.gouv.fr/datasets/population/",
    ...overrides,
  };
}

export function fakeResourceDetail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  const id = overrides.id ?? FAKE_IDS.resourceTabularCsv;
  return {
    id,
    datasetId: FAKE_IDS.dataset,
    title: "population-2024.csv",
    description: "Population par commune",
    format: "csv",
    mime: "text/csv",
    type: "main",
    filetype: "file",
    filesize: 12_345,
    url: `https://static.data.gouv.fr/resources/population/${id}/population-2024.csv`,
    latestUrl: `https://www.data.gouv.fr/api/1/datasets/r/${id}`,
    previewUrl: undefined,
    createdAt: "2025-01-01T00:00:00+00:00",
    lastModified: "2026-01-15T08:30:00+00:00",
    schema: undefined,
    checksum: undefined,
    analysis: {
      checkAvailable: true,
      checkStatus: 200,
      checkError: undefined,
      checkDate: "2026-09-01T00:00:00+00:00",
      detectedMime: "text/csv",
      contentLength: 12_345,
      analysisError: undefined,
      parsingTable: "abcdef",
      parsingError: undefined,
      parquetUrl: undefined,
      parquetSize: undefined,
      geojsonUrl: undefined,
      pmtilesUrl: undefined,
      ogcMetadata: undefined,
      validation: undefined,
    },
    extras: {},
    ...overrides,
  };
}

export function fakeDatasetDetail(overrides: Partial<DatasetDetail> = {}): DatasetDetail {
  const summary = fakeDatasetSummary(overrides);
  const resources = overrides.resources ?? [
    fakeResourceDetail(),
    fakeResourceDetail({
      id: FAKE_IDS.resourceXlsx,
      title: "population-2024.xlsx",
      format: "xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  ];
  return {
    ...summary,
    description: "## Population\n\nRecensement de la population (description longue).",
    createdAt: "2014-01-01T00:00:00+00:00",
    frequency: "annual",
    temporalCoverage: undefined,
    spatial: { zones: ["country:fr"], granularity: "fr:commune" },
    badges: [],
    schema: undefined,
    resources,
    resourcesCount: resources.length,
    quality: undefined,
    ...overrides,
  };
}

export function fakeOrganization(
  overrides: Partial<OrganizationSummary> = {},
): OrganizationSummary {
  return {
    id: FAKE_IDS.organization,
    name: "Etalab",
    slug: "etalab",
    acronym: undefined,
    badges: ["public-service", "certified"],
    metrics: { datasets: 100, reuses: 10, followers: 50, views: 1000 },
    url: "https://www.data.gouv.fr/organizations/etalab/",
    ...overrides,
  };
}

export function fakeDataservice(overrides: Partial<DataserviceDetail> = {}): DataserviceDetail {
  return {
    id: FAKE_IDS.dataservice,
    title: "API Adresse (Base Adresse Nationale)",
    description: "Géocodage d'adresses.",
    organization: {
      id: FAKE_IDS.organization,
      name: "Etalab",
      slug: "etalab",
      url: "https://www.data.gouv.fr/organizations/etalab/",
    },
    baseApiUrl: "https://api-adresse.data.gouv.fr",
    machineDocumentationUrl: "https://api-adresse.data.gouv.fr/openapi.json",
    tags: ["adresse"],
    url: "https://www.data.gouv.fr/dataservices/api-adresse/",
    businessDocumentationUrl: "https://adresse.data.gouv.fr/api-doc/adresse",
    license: "fr-lo",
    availability: 99.9,
    accessType: "open",
    createdAt: "2024-11-07T00:00:00+00:00",
    lastModified: "2026-01-01T00:00:00+00:00",
    datasetsCount: 1,
    ...overrides,
  };
}

export function fakeReuse(overrides: Partial<ReuseSummary> = {}): ReuseSummary {
  return {
    id: "5f2b6f2a8b4c410a1d3c0001",
    title: "Carte de la population",
    slug: "carte-de-la-population",
    type: "visualization",
    topic: "society_and_demography",
    organization: undefined,
    datasetsCount: 1,
    url: "https://www.data.gouv.fr/reuses/carte-de-la-population/",
    ...overrides,
  };
}

export function fakeTopic(overrides: Partial<TopicSummary> = {}): TopicSummary {
  return {
    id: "6440ac2a2ef7a8ee8f4b0001",
    name: "Transports",
    slug: "transports",
    description: "Données de transport.",
    tags: ["transport"],
    url: "https://www.data.gouv.fr/topics/transports/",
    ...overrides,
  };
}

export function fakeTableSchema(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    columns: [
      {
        name: "code_commune",
        type: "string",
        nativeType: "string",
        nullable: false,
        stats: undefined,
      },
      {
        name: "nom_commune",
        type: "string",
        nativeType: "string",
        nullable: false,
        stats: undefined,
      },
      { name: "population", type: "integer", nativeType: "int", nullable: true, stats: undefined },
    ],
    rowCount: 3,
    source: "tabular-api",
    ...overrides,
  };
}

export const FAKE_ROWS: Row[] = [
  { code_commune: "75056", nom_commune: "Paris", population: 2_102_650 },
  { code_commune: "13055", nom_commune: "Marseille", population: 873_076 },
  { code_commune: "69123", nom_commune: "Lyon", population: 522_250 },
];

export function fakeTableSlice(overrides: Partial<TableSlice> = {}): TableSlice {
  return {
    columns: ["code_commune", "nom_commune", "population"],
    rows: FAKE_ROWS,
    total: FAKE_ROWS.length,
    page: 1,
    pageSize: 20,
    hasNext: false,
    truncated: false,
    ...overrides,
  };
}

export function fakeTabularPage(overrides: Partial<TabularPage> = {}): TabularPage {
  return {
    rows: FAKE_ROWS,
    page: 1,
    pageSize: 20,
    total: FAKE_ROWS.length,
    nextUrl: undefined,
    ...overrides,
  };
}

export function fakeCapabilityReport(overrides: Partial<CapabilityReport> = {}): CapabilityReport {
  const resourceId = overrides.resourceId ?? FAKE_IDS.resourceTabularCsv;
  const primary: ResourceCapability = overrides.primary ?? "tabular_api";
  return {
    resourceId,
    primary,
    capabilities: overrides.capabilities ?? [primary, "stream_parse", "metadata_only"],
    strategy: "tabular-api",
    confidence: "high",
    formatFamily: "tabular",
    detectedFormat: "csv",
    compression: undefined,
    reasons: ["fake detector"],
    urls: {
      download: `https://static.data.gouv.fr/resources/population/${resourceId}/population-2024.csv`,
      latest: `https://www.data.gouv.fr/api/1/datasets/r/${resourceId}`,
      parquet: undefined,
      geojson: undefined,
      preview: undefined,
      tabularApi: `https://tabular-api.data.gouv.fr/api/resources/${resourceId}/data/`,
    },
    sizeBytes: 12_345,
    tabularProbe: "available",
    warnings: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Fake clients                                                        */
/* ------------------------------------------------------------------ */

export interface FakeClientsOptions {
  datagouv?: Partial<DatagouvClient>;
  tabular?: Partial<TabularClient>;
  metrics?: Partial<MetricsClient>;
  crawler?: Partial<CrawlerClient>;
  schema?: Partial<SchemaClient>;
  /** Datasets known to `getDataset`/`listDatasetResources` (default: one fake dataset). */
  datasets?: DatasetDetail[];
  /** Resources known to `getResource` (default: the fake dataset's resources). */
  resources?: ResourceDetail[];
}

export interface FakeClients extends Clients {
  calls: CallRecord[];
}

export function fakeDatagouvClient(
  overrides: Partial<DatagouvClient> = {},
  data: { datasets?: DatasetDetail[]; resources?: ResourceDetail[] } = {},
): DatagouvClient {
  const datasets = data.datasets ?? [fakeDatasetDetail()];
  const resources =
    data.resources ??
    datasets.flatMap((d) => d.resources.map((r) => fakeResourceDetail({ ...r, datasetId: d.id })));
  const base: DatagouvClient = {
    searchDatasets: async (params) =>
      fakePage(datasets.map(fakeDatasetSummary), {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      }),
    getDataset: async (idOrSlug) => {
      const found = datasets.find((d) => d.id === idOrSlug || d.slug === idOrSlug);
      if (!found) throw new NotFoundError(`Dataset with ID '${idOrSlug}' not found.`);
      return found;
    },
    getResource: async (id) => {
      const found = resources.find((r) => r.id === id);
      if (!found) throw new NotFoundError(`Resource with ID '${id}' not found.`);
      return found;
    },
    listDatasetResources: async (datasetId, page = 1, pageSize = 200) => {
      const dataset = datasets.find((d) => d.id === datasetId || d.slug === datasetId);
      if (!dataset) throw new NotFoundError(`Dataset with ID '${datasetId}' not found.`);
      const items = resources.filter((r) => r.datasetId === dataset.id);
      return fakePage(items, { page, pageSize });
    },
    searchOrganizations: async (params) =>
      fakePage([fakeOrganization()], { page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
    searchDataservices: async (params) =>
      fakePage([fakeDataservice()], { page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
    getDataservice: async (id) => {
      const ds = fakeDataservice();
      if (id !== ds.id) throw new NotFoundError(`Dataservice with ID '${id}' not found.`);
      return ds;
    },
    listReuses: async (params) =>
      fakePage([fakeReuse()], { page: params.page ?? 1, pageSize: params.pageSize ?? 20 }),
    searchTopics: async (_query, page = 1, pageSize = 20) =>
      fakePage([fakeTopic()], { page, pageSize }),
    getTopic: async (idOrSlug) => {
      const topic = fakeTopic();
      if (idOrSlug !== topic.id && idOrSlug !== topic.slug) {
        throw new NotFoundError(`Topic with ID '${idOrSlug}' not found.`);
      }
      return { ...topic, elements: datasets.map(fakeDatasetSummary) };
    },
    suggest: async (_query, size = 5): Promise<Suggestion[]> =>
      datasets
        .slice(0, size)
        .map((d) => ({ id: d.id, text: d.title, kind: "dataset", url: d.url })),
    fetchOpenApiSpec: async () => ({
      openapi: "3.0.0",
      info: { title: "Fake API", version: "1.0.0" },
      servers: [{ url: "https://api.example.gouv.fr" }],
      paths: {
        "/search": { get: { summary: "Search", parameters: [{ name: "q", in: "query" }] } },
      },
    }),
  };
  return { ...base, ...overrides };
}

export function fakeTabularClient(overrides: Partial<TabularClient> = {}): TabularClient {
  return {
    getProfile: async (resourceId) =>
      resourceId === FAKE_IDS.resourceDeadRemote ? undefined : fakeTableSchema(),
    queryData: async (_resourceId, query) =>
      fakeTabularPage({ page: query.page ?? 1, pageSize: query.pageSize ?? 20 }),
    isAggregationAllowed: async () => false,
    ...overrides,
  };
}

export function fakeMetricsClient(overrides: Partial<MetricsClient> = {}): MetricsClient {
  return {
    getMonthlyMetrics: async (_model, _id, limit = 12) =>
      Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
        month: `2026-0${3 - i}`,
        values: { monthly_visit: 100 * (i + 1), monthly_download_resource: 10 * (i + 1) },
      })),
    ...overrides,
  };
}

export function fakeCrawlerClient(overrides: Partial<CrawlerClient> = {}): CrawlerClient {
  return {
    getResourceExceptions: async () => new Set([FAKE_IDS.resourceLargeCsv]),
    ...overrides,
  };
}

export function fakeSchemaClient(overrides: Partial<SchemaClient> = {}): SchemaClient {
  const entry = {
    name: "etalab/schema-irve-statique",
    title: "IRVE statique",
    description: "Infrastructures de recharge pour véhicules électriques.",
    schemaType: "tableschema" as const,
    schemaUrl:
      "https://schema.data.gouv.fr/schemas/etalab/schema-irve-statique/latest/schema-statique.json",
    latestVersion: "2.3.1",
    versions: ["2.3.0", "2.3.1"],
    homepage: "https://github.com/etalab/schema-irve",
    consolidationDatasetId: "5448d3e0c751df01f85d0572",
  };
  return {
    listSchemas: async (query) =>
      !query ||
      entry.name.includes(query) ||
      entry.title.toLowerCase().includes(query.toLowerCase())
        ? [entry]
        : [],
    getSchema: async (name) => {
      if (name !== entry.name) throw new NotFoundError(`Schema '${name}' not found.`);
      return {
        ...entry,
        fields: [
          {
            name: "id_pdc_itinerance",
            type: "string",
            description: "Identifiant",
            required: true,
            constraints: undefined,
          },
          {
            name: "puissance_nominale",
            type: "number",
            description: "kW",
            required: true,
            constraints: undefined,
          },
        ],
      };
    },
    validateResource: async () => ({ valid: true, errorCount: 0, errors: [] }),
    ...overrides,
  };
}

/** Full `Clients` fake with call recording (`clients.calls`). */
export function fakeClients(options: FakeClientsOptions = {}): FakeClients {
  const calls: CallRecord[] = [];
  const datasets = options.datasets;
  const resources = options.resources;
  return {
    calls,
    datagouv: recording(
      fakeDatagouvClient(options.datagouv, { datasets, resources }),
      calls,
      "datagouv",
    ),
    tabular: recording(fakeTabularClient(options.tabular), calls, "tabular"),
    metrics: recording(fakeMetricsClient(options.metrics), calls, "metrics"),
    crawler: recording(fakeCrawlerClient(options.crawler), calls, "crawler"),
    schema: recording(fakeSchemaClient(options.schema), calls, "schema"),
  };
}

/* ------------------------------------------------------------------ */
/* Fake formats layer                                                  */
/* ------------------------------------------------------------------ */

export interface FakeAccessorOptions {
  id?: string;
  capabilities?: ResourceCapability[];
  schema?: TableSchema | undefined;
  preview?: PreviewResult;
  /** When set, the accessor supports `query()`; otherwise it throws `UnsupportedCapabilityError`. */
  query?: (ctx: AccessContext, spec: QuerySpec) => Promise<TableSlice>;
  supports?: (ctx: AccessContext) => boolean;
}

export function fakePreviewResult(overrides: Partial<PreviewResult> = {}): PreviewResult {
  return {
    kind: "table",
    table: fakeTableSlice(),
    facts: { delimiter: ",", encoding: "utf-8" },
    notes: [],
    ...overrides,
  };
}

/** Accessor serving canned schema/preview/query; records calls on `.calls`. */
export function fakeAccessor(
  options: FakeAccessorOptions = {},
): ResourceAccessor & { calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const capabilities = options.capabilities ?? ["tabular_api", "stream_parse"];
  const accessor: ResourceAccessor & { calls: CallRecord[] } = {
    id: options.id ?? "fake-accessor",
    capabilities,
    calls,
    supports: (ctx) => {
      calls.push({ method: "supports", args: [ctx.resource.id] });
      return options.supports ? options.supports(ctx) : true;
    },
    getSchema: async (ctx) => {
      calls.push({ method: "getSchema", args: [ctx.resource.id] });
      return "schema" in options ? options.schema : fakeTableSchema();
    },
    preview: async (ctx, previewOptions) => {
      calls.push({ method: "preview", args: [ctx.resource.id, previewOptions] });
      return options.preview ?? fakePreviewResult();
    },
  };
  const query = options.query;
  if (query) {
    accessor.query = async (ctx, spec) => {
      calls.push({ method: "query", args: [ctx.resource.id, spec] });
      return query(ctx, spec);
    };
  } else {
    accessor.query = async (ctx) => {
      calls.push({ method: "query", args: [ctx.resource.id] });
      throw new UnsupportedCapabilityError(
        `Resource ${ctx.resource.id} cannot be queried in this test`,
        {
          hint: "Use preview_resource instead.",
        },
      );
    };
  }
  return accessor;
}

/** Registry pre-loaded with one queryable fake accessor (override with `accessors`). */
export function fakeAccessorRegistry(accessors?: ResourceAccessor[]): AccessorRegistry {
  return createAccessorRegistry(
    accessors ?? [
      fakeAccessor({ query: async (_ctx, spec) => fakeTableSlice({ page: spec.page ?? 1 }) }),
    ],
  );
}

export interface FakeFormatsDeps {
  registry: AccessorRegistry;
  detectCapability: CapabilityDetector;
  engine: QueryEngine | undefined;
  calls: CallRecord[];
}

export interface FakeFormatsOptions {
  registry?: AccessorRegistry;
  /** Static report overrides or a per-resource function. */
  report?: Partial<CapabilityReport> | ((resource: ResourceDetail) => CapabilityReport);
  engine?: QueryEngine;
}

/** Formats-layer deps (`registry`, `detectCapability`, `engine`) driven by a canned report. */
export function fakeFormatsDeps(options: FakeFormatsOptions = {}): FakeFormatsDeps {
  const calls: CallRecord[] = [];
  const detectCapability: CapabilityDetector = async (resource, detectOptions) => {
    calls.push({ method: "detectCapability", args: [resource.id, detectOptions] });
    if (typeof options.report === "function") return options.report(resource);
    return fakeCapabilityReport({ resourceId: resource.id, ...options.report });
  };
  return {
    registry: options.registry ?? fakeAccessorRegistry(),
    detectCapability,
    engine: options.engine,
    calls,
  };
}

/** In-memory `QueryEngine` fake (e.g. to test the `sql` path without DuckDB). */
export function fakeQueryEngine(
  overrides: Partial<QueryEngine> & { available?: boolean } = {},
): QueryEngine {
  const { available = true, ...rest } = overrides;
  return {
    id: "fake-engine",
    isAvailable: async () => available,
    queryUrl: async (_url, _format, spec) => fakeTableSlice({ page: spec.page ?? 1 }),
    describeUrl: async () => fakeTableSchema({ source: "inferred" }),
    ...rest,
  };
}
