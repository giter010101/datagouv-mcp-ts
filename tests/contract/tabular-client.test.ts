import { describe, expect, it } from "vitest";
import { IDS, withClients } from "./harness.js";

describe("HttpTabularClient (offline fixtures)", () => {
  it("getProfile maps csv-detective columns from the recorded profile", async () => {
    await withClients(
      (mock) => {
        mock.tabular(`/resources/${IDS.resourceTabular}/profile/`, {
          fixture: "tabular/profile-a86ebc34",
        });
      },
      async (clients) => {
        const schema = await clients.tabular.getProfile(IDS.resourceTabular);
        expect(schema).toBeDefined();
        expect(schema?.source).toBe("tabular-api");
        expect(schema?.columns.map((c) => c.name)).toEqual(
          expect.arrayContaining(["code_insee", "commune", "departement", "gentile"]),
        );
      },
    );
  });

  it("queryData maps a recorded data page", async () => {
    await withClients(
      (mock) => {
        mock.tabular(`/resources/${IDS.resourceTabular}/data/`, {
          fixture: "tabular/data-a86ebc34-page1",
        });
      },
      async (clients) => {
        const page = await clients.tabular.queryData(IDS.resourceTabular, {
          page: 1,
          pageSize: 5,
        });
        expect(page.rows.length).toBeGreaterThan(0);
        expect(page.rows[0]).toHaveProperty("code_insee");
        expect(page.page).toBe(1);
        expect(page.total).toBeGreaterThan(0);
      },
    );
  });

  it("getProfile returns undefined on recorded 404", async () => {
    await withClients(
      (mock) => {
        mock.tabular(`/resources/${IDS.resourceNotTabular}/profile/`, {
          fixture: "tabular/profile-not-found",
        });
      },
      async (clients) => {
        await expect(clients.tabular.getProfile(IDS.resourceNotTabular)).resolves.toBeUndefined();
      },
    );
  });

  it("isAvailable is false when resource meta is 404", async () => {
    await withClients(
      (mock) => {
        mock.tabular(`/resources/${IDS.resourceNotTabular}/`, {
          status: 404,
          json: { detail: "not found" },
        });
      },
      async (clients) => {
        await expect(clients.tabular.isAvailable(IDS.resourceNotTabular)).resolves.toBe(false);
      },
    );
  });
});
