import { Agent, setGlobalDispatcher } from "undici";
import { afterAll, describe, expect, it } from "vitest";
import { createHttpClient } from "../../../src/core/http.js";
import type { ResourceDetail } from "../../../src/core/types.js";
import { createEngines } from "../../../src/formats/engines/index.js";
import { openResource } from "../../../src/formats/open.js";
import { emptyAnalysis } from "./helpers.js";

/**
 * Live walk over research/03 example resource IDs.
 * Gated by DATAGOUV_LIVE=1. Never throws: failures are recorded as metadata notes.
 * Offline `pnpm test` skips this file's tests.
 */
const LIVE = process.env.DATAGOUV_LIVE === "1" || process.env.RUN_LIVE_TESTS === "1";

/** ~15 IDs from `.agent/research/03-resource-formats-catalog.md` §1.2 / §9. */
const LIVE_IDS = [
  "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  "52200d61-5e80-4a4e-999f-6e1c184fa122",
  "45f3844f-0039-48ec-ade7-7dc8c429168b",
  "dbab1fa5-b902-4586-81e0-6063a6f96ca9",
  "4792c248-8b80-4524-8605-7d4213e49051",
  "84719f62-cdd4-4d7c-b292-2aafa56c6043",
  "202c55f0-6be6-4880-8055-9c6a03892857",
  "7c257c68-14ec-495e-9823-99d30ccab111",
  "4babf5f2-6a9c-45b5-9144-ca5eae6a7a6d",
  "4d344bb5-abfb-4cb5-a9aa-4b7f26c00466",
  "8ea6f0fa-1d90-4afd-ad7b-739f4c4c6860",
  "a39eb5fa-65ac-40bf-b639-b18b7ba03f5d",
  "08f143f0-e125-45b1-a727-83b6576cef60",
  "bbaca630-1312-469b-a8d5-a326411c2405",
  "15d95744-879d-4c3f-a00a-14be05a72b35",
] as const;

describe.skipIf(!LIVE)("live walk (DATAGOUV_LIVE=1)", () => {
  const agent = new Agent();
  setGlobalDispatcher(agent);
  const http = createHttpClient({ timeoutMs: 20_000, retries: 1, fetchImpl: fetch });

  afterAll(async () => {
    await agent.close();
  });

  it("opens each catalog example without throwing", async () => {
    const engines = createEngines({ http, maxDownloadBytes: 2 * 1024 * 1024, enableDuckdb: false });
    const deps = {
      http,
      tabular: {
        getProfile: async (id: string) => {
          try {
            const url = `https://tabular-api.data.gouv.fr/api/resources/${id}/profile/`;
            const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) return undefined;
            return { columns: [], rowCount: undefined, source: "tabular-api" as const };
          } catch {
            return undefined;
          }
        },
        queryData: async () => ({ rows: [], page: 1, pageSize: 20, total: 0 }),
      },
      tabularApiBaseUrl: "https://tabular-api.data.gouv.fr",
      maxDownloadBytes: 2 * 1024 * 1024,
      engines,
    };
    const outcomes: Array<{ id: string; primary: string; kind: string }> = [];
    for (const id of LIVE_IDS) {
      const raw = (await http
        .getJson(`https://www.data.gouv.fr/api/2/datasets/resources/${id}/`)
        .catch(() => undefined)) as Record<string, unknown> | undefined;
      const meta: ResourceDetail = {
        id,
        title: typeof raw?.title === "string" ? raw.title : id,
        description: undefined,
        format: typeof raw?.format === "string" ? raw.format : "",
        mime: typeof raw?.mime === "string" ? raw.mime : undefined,
        type: (typeof raw?.type === "string" ? raw.type : "main") as ResourceDetail["type"],
        filetype: (typeof raw?.filetype === "string"
          ? raw.filetype
          : "remote") as ResourceDetail["filetype"],
        filesize: typeof raw?.filesize === "number" ? raw.filesize : undefined,
        url:
          typeof raw?.url === "string" ? raw.url : `https://www.data.gouv.fr/fr/datasets/r/${id}`,
        latestUrl: `https://www.data.gouv.fr/api/1/datasets/r/${id}`,
        previewUrl: undefined,
        createdAt: undefined,
        lastModified: undefined,
        schema: undefined,
        datasetId: "live",
        checksum: undefined,
        extras: {},
        analysis: { ...emptyAnalysis },
      };
      const opened = await openResource(meta, deps, { offline: true });
      const preview = await opened.preview({ limit: 5 });
      outcomes.push({ id, primary: opened.report.primary, kind: preview.kind });
    }
    expect(outcomes).toHaveLength(LIVE_IDS.length);
    expect(outcomes.every((o) => typeof o.kind === "string")).toBe(true);
  });
});
