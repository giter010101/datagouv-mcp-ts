import { describe, expect, it } from "vitest";
import { IDS, withClients } from "./harness.js";

describe("HttpMetricsClient (offline fixtures)", () => {
  it("getMonthlyMetrics maps recorded dataset months", async () => {
    await withClients(
      (mock) => {
        mock.metrics("/datasets/data/", { fixture: "metrics/datasets-population" });
      },
      async (clients) => {
        const rows = await clients.metrics.getMonthlyMetrics("datasets", IDS.dataset, 3);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]?.month).toMatch(/^\d{4}-\d{2}$/);
        expect(rows[0]?.values).toHaveProperty("monthly_visit");
      },
    );
  });

  it("getMonthlyMetrics returns an empty list when the fixture has no rows", async () => {
    await withClients(
      (mock) => {
        mock.metrics("/resources/data/", { fixture: "metrics/resources-a86ebc34" });
      },
      async (clients) => {
        const rows = await clients.metrics.getMonthlyMetrics("resources", IDS.resourceTabular, 3);
        expect(rows).toEqual([]);
      },
    );
  });
});
