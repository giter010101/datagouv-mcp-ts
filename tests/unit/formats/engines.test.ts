import { describe, expect, it } from "vitest";
import { EngineUnavailableError, ValidationError } from "../../../src/core/errors.js";
import { createEngines } from "../../../src/formats/engines/index.js";
import { applyQuery, matchesFilter } from "../../../src/formats/engines/query.js";
import { guardReadOnlySql } from "../../../src/formats/engines/sql-guard.js";

const rows = [
  { nom: "Alice", montant: 10, ville: "Paris" },
  { nom: "Bob", montant: 20, ville: "Lyon" },
  { nom: "Alice", montant: 5, ville: "Paris" },
];

describe("applyQuery — tabular-api vocabulary", () => {
  it("filters (exact/contains/in/greater), sorts, paginates", () => {
    const filtered = applyQuery(rows, {
      filters: [{ column: "nom", operator: "contains", value: "li" }],
      sort: [{ column: "montant", direction: "desc" }],
      page: 1,
      pageSize: 10,
    });
    expect(filtered.rows.map((r) => r.montant)).toEqual([10, 5]);
    expect(
      matchesFilter(rows[1] ?? {}, { column: "ville", operator: "in", value: "Lyon,Paris" }),
    ).toBe(true);
    const page = applyQuery(rows, { page: 2, pageSize: 2 });
    expect(page.rows).toHaveLength(1);
    expect(page.hasNext).toBe(false);
    expect(page.total).toBe(3);
  });

  it("aggregates count/sum/avg grouped by column", () => {
    const result = applyQuery(rows, {
      aggregate: {
        groupBy: ["nom"],
        metrics: [
          { op: "count" },
          { op: "sum", column: "montant" },
          { op: "avg", column: "montant" },
        ],
      },
      sort: [{ column: "nom", direction: "asc" }],
    });
    const alice = result.rows.find((r) => r.nom === "Alice");
    expect(alice).toMatchObject({ count: 2, montant__sum: 15 });
    expect(alice?.montant__avg).toBe(7.5);
  });
});

describe("sql-guard", () => {
  it("allows a single SELECT and rejects DDL / COPY", () => {
    expect(guardReadOnlySql("SELECT * FROM data").sql).toBe("SELECT * FROM data");
    expect(() => guardReadOnlySql("DROP TABLE data")).toThrow(ValidationError);
    expect(() => guardReadOnlySql("SELECT 1; SELECT 2")).toThrow(ValidationError);
    expect(() => guardReadOnlySql("SELECT * FROM read_csv('x.csv')")).toThrow(/Forbidden/);
  });
});

describe("createEngines factory", () => {
  it("picks pure-js when DuckDB is disabled", async () => {
    const engines = createEngines({
      http: { request: async () => new Response() } as never,
      maxDownloadBytes: 1000,
      enableDuckdb: false,
    });
    expect(engines.duckdb).toBeUndefined();
    const picked = await engines.select({ format: "parquet", sizeBytes: 99_000_000, sql: true });
    expect(picked.id).toBe("pure-js");
    await expect(picked.queryUrl("https://x", "csv", { sql: "SELECT 1" })).rejects.toBeInstanceOf(
      EngineUnavailableError,
    );
  });
});
