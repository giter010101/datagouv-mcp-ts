import { gzipSync } from "node:zlib";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { UnsupportedCapabilityError } from "../../../src/core/errors.js";
import { createMetadataAccessor } from "../../../src/formats/accessors/api-metadata.js";
import { defaultAccessors } from "../../../src/formats/accessors/index.js";
import { openResource } from "../../../src/formats/open.js";
import { createAccessorRegistry } from "../../../src/formats/registry.js";
import {
  ctxFor,
  fakeFetch,
  fakeTabular,
  fixture,
  resource,
  testDeps,
  testHttp,
} from "./helpers.js";

function xlsxBytes(): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["id", "nom", "montant"],
      [1, "Alice", 10],
      [2, "Bob", 20],
    ]),
    "Feuille1",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"], [1]]), "Autre");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

function zipWithCsv(): Uint8Array {
  const csv = fixture("sample.csv");
  return zipSync({ "data/sample.csv": csv, "readme.txt": new TextEncoder().encode("hi") });
}

describe("accessors — tabular API", () => {
  it("previews and queries via tabular client", async () => {
    const rows = [
      { id: 1, nom: "Alice" },
      { id: 2, nom: "Bob" },
    ];
    const schema = {
      columns: [
        {
          name: "id",
          type: "integer" as const,
          nativeType: "int",
          nullable: false,
          stats: undefined,
        },
        {
          name: "nom",
          type: "string" as const,
          nativeType: "str",
          nullable: false,
          stats: undefined,
        },
      ],
      rowCount: 2,
      source: "tabular-api" as const,
    };
    const tabular = fakeTabular(schema, rows);
    const { fetch } = fakeFetch({});
    const deps = testDeps(testHttp(fetch), { tabular });
    const res = resource({
      analysis: { parsingTable: "t" },
    });
    const opened = await openResource(res, deps, { offline: true });
    expect(opened.accessor.id).toBe("tabular-api");
    expect((await opened.getSchema())?.source).toBe("tabular-api");
    const preview = await opened.preview();
    expect(preview.kind).toBe("table");
    expect(preview.table?.rows).toHaveLength(2);
    const queried = await opened.query({
      filters: [{ column: "nom", operator: "exact", value: "Alice" }],
      pageSize: 20,
    });
    expect(tabular.calls.length).toBeGreaterThan(0);
    expect(queried.total).toBe(2);
  });
});

describe("accessors — csv / gzip / spreadsheet / json / xml / geojson", () => {
  it("parses CSV with semicolon dialect, filters and aggregates", async () => {
    const csv = fixture("sample.csv");
    const { fetch } = fakeFetch({ "https://static.data.gouv.fr/resources/test/res-0000.csv": csv });
    const deps = testDeps(testHttp(fetch));
    const opened = await openResource(resource({}), deps, { offline: true });
    expect(opened.accessor.id).toBe("csv-stream");
    const preview = await opened.preview({ limit: 10 });
    expect(preview.table?.rows.length).toBeGreaterThanOrEqual(3);
    const slice = await opened.query({
      filters: [{ column: "nom", operator: "exact", value: "Alice" }],
      aggregate: { groupBy: ["nom"], metrics: [{ op: "sum", column: "montant" }] },
    });
    expect(slice.rows[0]?.montant__sum).toBe(15.5);
  });

  it("transparently gunzips csv.gz", async () => {
    const gz = new Uint8Array(gzipSync(Buffer.from(fixture("sample.csv"))));
    const res = resource({ format: "csv", url: "https://example.org/f.csv.gz" });
    const { fetch } = fakeFetch({ "https://example.org/f.csv.gz": gz });
    const opened = await openResource(res, testDeps(testHttp(fetch)), { offline: true });
    const preview = await opened.preview();
    expect(preview.table?.rows.length).toBeGreaterThan(0);
  });

  it("lists spreadsheet sheets and reads the named member", async () => {
    const bytes = xlsxBytes();
    const res = resource({
      format: "xlsx",
      url: "https://example.org/t.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const { fetch } = fakeFetch({ "https://example.org/t.xlsx": bytes });
    const opened = await openResource(res, testDeps(testHttp(fetch)), { offline: true });
    expect(opened.accessor.id).toBe("spreadsheet");
    const preview = await opened.preview();
    expect(preview.facts.sheets).toEqual(["Feuille1", "Autre"]);
    const other = await opened.preview({ member: "Autre" });
    expect(other.table?.columns).toContain("x");
  });

  it("parses JSON array, JSONL, XML records and GeoJSON bbox", async () => {
    const routes = {
      "https://example.org/a.json": fixture("sample.json"),
      "https://example.org/a.jsonl": fixture("sample.jsonl"),
      "https://example.org/a.xml": fixture("sample.xml"),
      "https://example.org/a.geojson": fixture("sample.geojson"),
    };
    const { fetch } = fakeFetch(routes);
    const deps = testDeps(testHttp(fetch));
    const json = await openResource(
      resource({ format: "json", url: "https://example.org/a.json" }),
      deps,
      { offline: true },
    );
    expect((await json.preview()).table?.rows).toHaveLength(2);
    const jsonl = await openResource(
      resource({ format: "jsonl", url: "https://example.org/a.jsonl" }),
      deps,
      { offline: true },
    );
    expect(jsonl.report.detectedFormat).toBe("jsonl");
    expect(jsonl.accessor.id).toBe("json");
    const jsonlPreview = await jsonl.preview();
    expect(jsonlPreview.table?.rows.length).toBeGreaterThanOrEqual(1);
    expect(jsonlPreview.facts.recordsPath).toBeDefined();
    const xml = await openResource(
      resource({ format: "xml", url: "https://example.org/a.xml" }),
      deps,
      { offline: true },
    );
    expect(xml.accessor.id).toBe("xml");
    expect((await xml.preview()).table?.rows.length).toBeGreaterThanOrEqual(1);
    const geo = await openResource(
      resource({ format: "geojson", url: "https://example.org/a.geojson" }),
      deps,
      { offline: true },
    );
    expect(geo.accessor.id).toBe("geojson");
    const g = await geo.preview();
    expect(g.kind).toBe("features");
    expect(g.facts.featureCount).toBe(1);
    expect(g.facts.bbox).toBeDefined();
  });
});

describe("accessors — archive, document, api, metadata", () => {
  it("lists ZIP entries and recurses into a CSV member", async () => {
    const zip = zipWithCsv();
    const res = resource({ format: "zip", url: "https://example.org/a.zip" });
    const { fetch } = fakeFetch({ "https://example.org/a.zip": zip });
    const opened = await openResource(res, testDeps(testHttp(fetch)), { offline: true });
    expect(opened.accessor.id).toBe("archive");
    const listing = await opened.preview();
    expect(listing.kind).toBe("entries");
    expect(listing.entries?.some((e) => e.name.includes("sample.csv"))).toBe(true);
    const nested = await opened.preview({ member: "data/sample.csv" });
    expect(nested.kind).toBe("table");
    expect(nested.table?.rows.length).toBeGreaterThan(0);
  });

  it("extracts HTML/markdown/txt; PDF preview does not throw", async () => {
    const { fetch } = fakeFetch({
      "https://example.org/a.html": fixture("sample.html"),
      "https://example.org/a.md": fixture("sample.md"),
      "https://example.org/a.pdf": fixture("sample.pdf"),
    });
    const deps = testDeps(testHttp(fetch));
    const html = await openResource(
      resource({ format: "html", url: "https://example.org/a.html" }),
      deps,
      { offline: true },
    );
    expect(html.accessor.id).toBe("document");
    const text = await html.preview();
    expect(text.kind).toBe("text");
    expect(text.text).toMatch(/Hello HTML/);
    const pdf = await openResource(
      resource({ format: "pdf", url: "https://example.org/a.pdf" }),
      deps,
      { offline: true },
    );
    const pdfPreview = await pdf.preview();
    expect(pdfPreview.kind === "text" || pdfPreview.kind === "metadata").toBe(true);
  });

  it("api-endpoint never fetches and metadata-only never throws", async () => {
    const { fetch, calls } = fakeFetch({ "https://wms.example/": "SHOULD_NOT_HIT" });
    const deps = testDeps(testHttp(fetch));
    const api = await openResource(
      resource({ format: "ogc:wms", type: "api", url: "https://wms.example/" }),
      deps,
      { offline: true },
    );
    expect(api.accessor.id).toBe("api-endpoint");
    const preview = await api.preview();
    expect(preview.facts.capabilitiesUrl).toMatch(/GetCapabilities/);
    expect(calls.filter((c) => c.method !== "HEAD")).toHaveLength(0);
    await expect(api.query({})).rejects.toBeInstanceOf(UnsupportedCapabilityError);

    const meta = createMetadataAccessor();
    const png = resource({ format: "png" });
    const ctx = ctxFor(png, {
      primary: "metadata_only",
      capabilities: ["metadata_only"],
      strategy: "metadata-only",
      detectedFormat: "png",
      formatFamily: "image",
    });
    const out = await meta.preview(ctx);
    expect(out.kind).toBe("metadata");
    expect(out.facts.url).toBeDefined();
  });

  it("openResource preview degrades instead of throwing on a dead URL", async () => {
    const { fetch } = fakeFetch({});
    const opened = await openResource(
      resource({ format: "csv", url: "https://example.org/missing.csv" }),
      testDeps(testHttp(fetch)),
      { offline: true },
    );
    const preview = await opened.preview();
    expect(preview.kind).toBe("metadata");
    expect(String(preview.facts.error ?? preview.notes.join(" "))).toMatch(
      /HTTP 404|not found|unavailable/i,
    );
  });
});

describe("defaultAccessors registry", () => {
  it("registers unique ids including metadata-only last", () => {
    const { fetch } = fakeFetch({});
    const accessors = defaultAccessors(testDeps(testHttp(fetch)));
    const ids = accessors.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe("metadata-only");
    const registry = createAccessorRegistry(accessors);
    expect(registry.list().length).toBe(ids.length);
  });
});
