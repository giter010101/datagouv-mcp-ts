import { describe, expect, it } from "vitest";
import type { TableSchema } from "../../../src/core/types.js";
import { detectCapability, normalizeResourceFormat } from "../../../src/formats/capability.js";
import type { CapabilityDetectorDeps } from "../../../src/formats/types.js";
import { resource } from "./helpers.js";

const schema: TableSchema = { columns: [], rowCount: 10, source: "tabular-api" };

function deps(overrides: Partial<CapabilityDetectorDeps> = {}): CapabilityDetectorDeps {
  return {
    probeTabular: async () => undefined,
    crawlerExceptions: async () => new Set(),
    tabularApiBaseUrl: "https://tabular-api.data.gouv.fr",
    maxDownloadBytes: 50 * 1024 * 1024,
    ...overrides,
  };
}

const enc = (s: string) => new TextEncoder().encode(s);

describe("normalizeResourceFormat", () => {
  it("normalises aliases, gzip and falls back to mime then URL", () => {
    expect(normalizeResourceFormat(resource({ format: "ESRI Shapefile" })).format).toBe("shp");
    expect(normalizeResourceFormat(resource({ format: "csv.gz" }))).toMatchObject({
      format: "csv",
      compression: "gzip",
    });
    expect(
      normalizeResourceFormat(resource({ format: "", mime: "application/geo+json" })).format,
    ).toBe("geojson");
    expect(
      normalizeResourceFormat(
        resource({ format: "", mime: undefined, url: "https://x.org/data/export.XLSX?dl=1" }),
      ),
    ).toMatchObject({ format: "xlsx", source: "url" });
    expect(
      normalizeResourceFormat(resource({ format: "gz", url: "https://x.org/f.csv.gz" })),
    ).toMatchObject({ format: "csv", compression: "gzip" });
    expect(normalizeResourceFormat(resource({ format: "", url: "https://x.org/" })).format).toBe(
      undefined,
    );
  });
});

describe("detectCapability — research/03 §9 scenarios", () => {
  it("tabular CSV (small) → tabular_api with parquet fallback and tabularApi url", async () => {
    const res = resource({
      id: "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
      analysis: { parsingTable: "abc", parquetUrl: "https://hydra/parquet/x.parquet" },
    });
    const report = await detectCapability(res, deps({ probeTabular: async () => schema }));
    expect(report.primary).toBe("tabular_api");
    expect(report.strategy).toBe("tabular-api");
    expect(report.capabilities).toEqual([
      "tabular_api",
      "parquet",
      "stream_parse",
      "metadata_only",
    ]);
    expect(report.tabularProbe).toBe("available");
    expect(report.urls.tabularApi).toBe(
      "https://tabular-api.data.gouv.fr/api/resources/a86ebc34-a979-4d6c-8f2a-9710a43dca93/",
    );
    expect(report.confidence).toBe("high");
  });

  it("tabular CSV with crawler exception → tabular_api_large + warning", async () => {
    const res = resource({
      id: "52200d61-5e80-4a4e-999f-6e1c184fa122",
      analysis: { parsingTable: "t" },
    });
    const report = await detectCapability(
      res,
      deps({ probeTabular: async () => schema, crawlerExceptions: async () => new Set([res.id]) }),
    );
    expect(report.primary).toBe("tabular_api_large");
    expect(report.warnings.join(" ")).toMatch(/Very large/);
  });

  it("tabular XLSX → tabular_api, spreadsheet fallback", async () => {
    const res = resource({ format: "xlsx", analysis: { parsingTable: "t" } });
    const report = await detectCapability(res, deps({ probeTabular: async () => schema }));
    expect(report.primary).toBe("tabular_api");
    expect(report.capabilities).toContain("stream_parse");
    expect(report.formatFamily).toBe("spreadsheet");
  });

  it("parsing_table present but probe 404 → downgrade to stream-csv", async () => {
    const res = resource({ analysis: { parsingTable: "t" } });
    const report = await detectCapability(res, deps());
    expect(report.tabularProbe).toBe("unavailable");
    expect(report.primary).toBe("stream_parse");
    expect(report.strategy).toBe("stream-csv");
  });

  it("CSV not in Tabular API → stream_parse (probe unavailable)", async () => {
    const res = resource({ id: "dbab1fa5-b902-4586-81e0-6063a6f96ca9" });
    const report = await detectCapability(res, deps());
    expect(report.primary).toBe("stream_parse");
    expect(report.strategy).toBe("stream-csv");
    expect(report.tabularProbe).toBe("unavailable");
  });

  it("CSV too large for Hydra with parquet conversion → hydra-parquet", async () => {
    const res = resource({
      filesize: 900_000_000,
      analysis: {
        analysisError: "File too large to download",
        parquetUrl: "https://hydra/p.parquet",
      },
    });
    const report = await detectCapability(res, deps());
    expect(report.primary).toBe("parquet");
    expect(report.strategy).toBe("hydra-parquet");
    expect(report.urls.parquet).toBe("https://hydra/p.parquet");
    expect(report.warnings.join(" ")).toMatch(/Hydra analysis error/);
  });

  it("dead remote HTML → dead_link, no probe", async () => {
    let probed = false;
    const res = resource({
      id: "4792c248-8b80-4524-8605-7d4213e49051",
      format: "html",
      filetype: "remote",
      analysis: { checkAvailable: false, checkStatus: 400, checkError: "Bad Request" },
    });
    const report = await detectCapability(
      res,
      deps({
        probeTabular: async () => {
          probed = true;
          return undefined;
        },
      }),
    );
    expect(report.primary).toBe("dead_link");
    expect(report.strategy).toBe("metadata-only");
    expect(report.capabilities).toEqual(["dead_link", "metadata_only"]);
    expect(report.warnings[0]).toMatch(/Dead link.*HTTP 400.*Bad Request/);
    expect(probed).toBe(false);
  });

  it("native parquet → parquet strategy", async () => {
    const res = resource({ id: "84719f62-cdd4-4d7c-b292-2aafa56c6043", format: "parquet" });
    const report = await detectCapability(res, deps());
    expect(report).toMatchObject({
      primary: "parquet",
      strategy: "parquet",
      formatFamily: "tabular",
    });
  });

  it("WMS service → api_endpoint (also via type=api and ogc_metadata)", async () => {
    const wms = await detectCapability(resource({ format: "ogc:wms" }), deps());
    expect(wms).toMatchObject({ primary: "api_endpoint", strategy: "api-endpoint" });
    const api = await detectCapability(resource({ format: "", type: "api" }), deps());
    expect(api.primary).toBe("api_endpoint");
    const ogc = await detectCapability(
      resource({ format: "", analysis: { ogcMetadata: { format: "wfs" } } }),
      deps(),
    );
    expect(ogc.primary).toBe("api_endpoint");
  });

  it("GeoJSON file → geo_preview; json with geo mime too; geojson_url adds fallback", async () => {
    const geo = await detectCapability(resource({ format: "geojson" }), deps());
    expect(geo).toMatchObject({ primary: "geo_preview", strategy: "geojson", formatFamily: "geo" });
    const mime = await detectCapability(
      resource({ format: "", mime: "application/geo+json" }),
      deps(),
    );
    expect(mime.strategy).toBe("geojson");
    const shp = await detectCapability(
      resource({ format: "shp", analysis: { geojsonUrl: "https://hydra/g.geojson" } }),
      deps(),
    );
    expect(shp.strategy).toBe("geojson");
    expect(shp.primary).toBe("geo_preview");
    expect(shp.capabilities).toContain("archive_inspect");
  });

  it("documentation type → document_preview; pdf → document; images → metadata_only", async () => {
    const doc = await detectCapability(
      resource({ format: "document", type: "documentation" }),
      deps(),
    );
    expect(doc.primary).toBe("document_preview");
    const pdf = await detectCapability(resource({ format: "pdf" }), deps());
    expect(pdf).toMatchObject({ primary: "document_preview", strategy: "document" });
    const png = await detectCapability(resource({ format: "png" }), deps());
    expect(png).toMatchObject({ primary: "metadata_only", formatFamily: "image" });
  });

  it("archives: zip → archive, shp → shapefile, 7z/gpkg → archive_inspect but metadata-only", async () => {
    expect((await detectCapability(resource({ format: "zip" }), deps())).strategy).toBe("archive");
    expect((await detectCapability(resource({ format: "7z" }), deps())).strategy).toBe(
      "metadata-only",
    );
    const gpkg = await detectCapability(resource({ format: "gpkg" }), deps());
    expect(gpkg.primary).toBe("archive_inspect");
    expect(gpkg.strategy).toBe("metadata-only");
  });

  it("json / jsonl / xml → stream_parse with matching strategy", async () => {
    expect((await detectCapability(resource({ format: "json" }), deps())).strategy).toBe("json");
    expect((await detectCapability(resource({ format: "ndjson" }), deps())).strategy).toBe("json");
    expect((await detectCapability(resource({ format: "xml" }), deps())).strategy).toBe("xml");
    expect((await detectCapability(resource({ format: "kml" }), deps())).strategy).toBe("xml");
  });

  it("remote with empty format and no sniff → remote_caution", async () => {
    const res = resource({
      format: "",
      mime: undefined,
      filetype: "remote",
      url: "https://x.org/data",
    });
    const report = await detectCapability(res, deps());
    expect(report.primary).toBe("remote_caution");
    expect(report.capabilities).toEqual(["remote_caution", "metadata_only"]);
  });

  it("offline mode never probes nor sniffs", async () => {
    let touched = false;
    const res = resource({ format: "", filetype: "remote", url: "https://x.org/data" });
    const report = await detectCapability(
      res,
      deps({
        probeTabular: async () => {
          touched = true;
          return schema;
        },
        sniffHead: async () => {
          touched = true;
          return enc("a,b\n1,2");
        },
      }),
      { offline: true },
    );
    expect(touched).toBe(false);
    expect(report.tabularProbe).toBe("skipped");
  });

  it("size above the cap adds a warning for stream_parse", async () => {
    const res = resource({ filesize: 200 * 1024 * 1024 });
    const report = await detectCapability(res, deps({ maxDownloadBytes: 50 * 1024 * 1024 }));
    expect(report.sizeBytes).toBe(200 * 1024 * 1024);
    expect(report.warnings.join(" ")).toMatch(/above the in-process cap/);
  });

  it("mime mismatch (declared csv, detected javascript) → warning", async () => {
    const res = resource({
      mime: "text/csv",
      analysis: { detectedMime: "application/javascript" },
    });
    const report = await detectCapability(res, deps());
    expect(report.warnings.join(" ")).toMatch(/Hydra detected/);
  });
});

describe("detectCapability — content sniffing", () => {
  it("declared csv but HTML content → document strategy with warning", async () => {
    const res = resource({ filetype: "remote", url: "https://insee.fr/page" });
    const report = await detectCapability(
      res,
      deps({ sniffHead: async () => enc("<!DOCTYPE html><html><head>") }),
    );
    expect(report.detectedFormat).toBe("html");
    expect(report.strategy).toBe("document");
    expect(report.warnings.join(" ")).toMatch(/serves an HTML page/);
  });

  it("declared csv but zip magic → archive", async () => {
    const res = resource({});
    const report = await detectCapability(
      res,
      deps({ sniffHead: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]) }),
    );
    expect(report.strategy).toBe("archive");
    expect(report.warnings.join(" ")).toMatch(/looks like zip/);
  });

  it("declared csv with gzip magic → csv + gzip compression", async () => {
    const res = resource({});
    const report = await detectCapability(
      res,
      deps({ sniffHead: async () => new Uint8Array([0x1f, 0x8b, 0x08, 0]) }),
    );
    expect(report.strategy).toBe("stream-csv");
    expect(report.compression).toBe("gzip");
  });

  it("empty format resolved by sniffing (csv / parquet / json array)", async () => {
    const csv = await detectCapability(
      resource({ format: "", filetype: "remote", url: "https://x.org/d" }),
      deps({ sniffHead: async () => enc("id;nom;valeur\n1;a;2\n") }),
    );
    expect(csv.strategy).toBe("stream-csv");
    expect(csv.confidence).toBe("high");
    const parquet = await detectCapability(
      resource({ format: "", filetype: "remote", url: "https://x.org/d" }),
      deps({ sniffHead: async () => enc("PAR1xxxx") }),
    );
    expect(parquet.strategy).toBe("parquet");
    const json = await detectCapability(
      resource({ format: "", filetype: "remote", url: "https://x.org/d" }),
      deps({ sniffHead: async () => enc('[{"a":1}]') }),
    );
    expect(json.strategy).toBe("json");
  });

  it("xlsx declared with zip magic and geojson declared with '{' are compatible (no warning)", async () => {
    const xlsx = await detectCapability(
      resource({ format: "xlsx", filetype: "remote", url: "https://x.org/f.xlsx" }),
      deps({ sniffHead: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }),
    );
    expect(xlsx.strategy).toBe("spreadsheet");
    expect(xlsx.warnings).toEqual([]);
    const geo = await detectCapability(
      resource({ format: "geojson", filetype: "remote", url: "https://x.org/f" }),
      deps({ sniffHead: async () => enc('{"type":"FeatureCollection"') }),
    );
    expect(geo.warnings).toEqual([]);
  });

  it("sniff failure is a warning, not an error; empty body flagged", async () => {
    const failing = await detectCapability(
      resource({ format: "", filetype: "remote", url: "https://x.org/d" }),
      deps({
        sniffHead: async () => {
          throw new Error("boom");
        },
      }),
    );
    expect(failing.warnings.join(" ")).toMatch(/Could not read the first bytes.*boom/);
    const empty = await detectCapability(
      resource({}),
      deps({ sniffHead: async () => new Uint8Array(0) }),
    );
    expect(empty.warnings.join(" ")).toMatch(/empty/);
  });

  it("does not sniff when parsing_table is present", async () => {
    let sniffed = false;
    await detectCapability(
      resource({ analysis: { parsingTable: "t" } }),
      deps({
        probeTabular: async () => schema,
        sniffHead: async () => {
          sniffed = true;
          return enc("x");
        },
      }),
    );
    expect(sniffed).toBe(false);
  });
});
