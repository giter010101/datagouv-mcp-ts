import { createClients, type Clients } from "../../src/clients/index.js";
import { createCache } from "../../src/core/cache.js";
import { createHttpClient } from "../../src/core/http.js";
import { type DatagouvMock, mockDatagouv } from "../helpers/mock-datagouv.js";

export const IDS = {
  dataset: "53699d0ea3a729239d205b2e",
  resourceTabular: "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  resourceNotTabular: "dbab1fa5-b902-4586-81e0-6063a6f96ca9",
  resourceLargeCsv: "52200d61-5e80-4a4e-999f-6e1c184fa122",
  organization: "534fff75a3a7292c64a77de4",
  dataservice: "672cf67802ef6b1be63b8975",
  reuse: "6a96cc1b2aeed626b1cb300e",
  topic: "68d26d38c8f655382d59e3ac",
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Recorded dataset payloads redact `quality` as a string; Zod expects a map. */
export function sanitizeDataset(raw: unknown): Record<string, unknown> {
  const dataset = asRecord(raw);
  return {
    ...dataset,
    quality:
      typeof dataset.quality === "object" && dataset.quality !== null ? dataset.quality : undefined,
  };
}

/** Catalogue `version` is a number; the client schema expects a string. */
export function sanitizeSchemaCatalog(raw: unknown): Record<string, unknown> {
  const catalog = asRecord(raw);
  return {
    ...catalog,
    version: catalog.version == null ? undefined : String(catalog.version),
  };
}

/** Recorded org payloads redact `metrics` as a string; Zod expects a map. */
export function sanitizeOrgPage(raw: unknown): Record<string, unknown> {
  const page = asRecord(raw);
  const data = Array.isArray(page.data)
    ? page.data.map((item) => {
        const org = asRecord(item);
        return {
          ...org,
          metrics: typeof org.metrics === "object" && org.metrics !== null ? org.metrics : {},
        };
      })
    : page.data;
  return { ...page, data };
}

export function createOfflineClients(mock: DatagouvMock): Clients {
  const http = createHttpClient({
    timeoutMs: 5_000,
    retries: 0,
    fetchImpl: mock.fetchImpl,
    sleep: async () => undefined,
  });
  const cache = createCache({ maxEntries: 200, defaultTtlMs: 60_000 });
  return createClients({ baseUrls: mock.baseUrls, datagouvApiEnv: "prod" }, { http, cache });
}

export async function withClients(
  wire: (mock: DatagouvMock) => void,
  run: (clients: Clients, mock: DatagouvMock) => Promise<void>,
): Promise<void> {
  const mock = mockDatagouv();
  try {
    wire(mock);
    await run(createOfflineClients(mock), mock);
  } finally {
    await mock.close();
  }
}
