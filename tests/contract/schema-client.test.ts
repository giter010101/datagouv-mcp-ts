import { describe, expect, it } from "vitest";
import { loadFixture } from "../helpers/mock-datagouv.js";
import { sanitizeSchemaCatalog, withClients } from "./harness.js";

describe("HttpSchemaClient (offline fixtures)", () => {
  it("listSchemas loads the recorded catalogue and filters by query", async () => {
    await withClients(
      (mock) => {
        mock.schema("/schemas/schemas.json", {
          json: sanitizeSchemaCatalog(loadFixture("schema/schemas-catalog")),
        });
      },
      async (clients) => {
        const all = await clients.schema.listSchemas();
        expect(all.some((s) => s.name === "etalab/schema-irve-statique")).toBe(true);
        const filtered = await clients.schema.listSchemas("irve");
        expect(filtered.every((s) => /irve/i.test(`${s.name} ${s.title} ${s.description}`))).toBe(
          true,
        );
        expect(filtered.length).toBeGreaterThan(0);
      },
    );
  });

  it("getSchema resolves IRVE fields from the recorded schema document", async () => {
    await withClients(
      (mock) => {
        mock.schema("/schemas/schemas.json", {
          json: sanitizeSchemaCatalog(loadFixture("schema/schemas-catalog")),
        });
        mock.schema("/schemas/etalab/schema-irve-statique/latest/schema-statique.json", {
          fixture: "schema/schema-irve-statique-latest",
        });
      },
      async (clients) => {
        const schema = await clients.schema.getSchema("etalab/schema-irve-statique");
        expect(schema.name).toBe("etalab/schema-irve-statique");
        expect(schema.schemaType).toBe("tableschema");
        expect(schema.resolvedUrl).toContain("schema-irve-statique");
        expect(schema.fields.length).toBeGreaterThan(0);
        expect(schema.fields.some((f) => f.name === "nom_amenageur")).toBe(true);
      },
    );
  });
});
