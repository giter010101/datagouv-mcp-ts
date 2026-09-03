import { describe, expect, it } from "vitest";
import { loadFixture } from "../helpers/mock-datagouv.js";
import { IDS, sanitizeDataset, sanitizeOrgPage, withClients } from "./harness.js";

describe("HttpDatagouvClient (offline fixtures)", () => {
  it("searchDatasets maps the v2 page without exposing facets", async () => {
    await withClients(
      (mock) => {
        mock.v2("/datasets/search/", { fixture: "datagouv/datasets-search-population" });
      },
      async (clients) => {
        const page = await clients.datagouv.searchDatasets({ query: "population", pageSize: 3 });
        expect(page.total).toBeGreaterThan(0);
        expect(page.items.length).toBeGreaterThan(0);
        expect(page.items[0]?.id).toBeTruthy();
        expect(page.items[0]?.title.toLowerCase()).toContain("population");
        expect(page).not.toHaveProperty("facets");
      },
    );
  });

  it("searchDatasetsWithFacets keeps facet buckets (HVD filter)", async () => {
    await withClients(
      (mock) => {
        mock.v2("/datasets/search/", { fixture: "datagouv/datasets-search-hvd" });
      },
      async (clients) => {
        const page = await clients.datagouv.searchDatasetsWithFacets({
          query: "",
          pageSize: 3,
          filters: { badge: "hvd" },
        });
        expect(page.items.length).toBeGreaterThan(0);
        expect(page.facets.badge?.some((b) => b.value === "hvd")).toBe(true);
        expect(page.facets.format?.length).toBeGreaterThan(0);
      },
    );
  });

  it("getDataset maps v1 detail for the Insee population dataset", async () => {
    await withClients(
      (mock) => {
        mock.v1(`/datasets/${IDS.dataset}/`, {
          json: sanitizeDataset(loadFixture("datagouv/dataset-population")),
        });
      },
      async (clients) => {
        const dataset = await clients.datagouv.getDataset(IDS.dataset);
        expect(dataset.id).toBe(IDS.dataset);
        expect(dataset.slug).toBe("population");
        expect(dataset.resources.length).toBeGreaterThan(0);
        expect(dataset.url).toContain("population");
      },
    );
  });

  it("getResource maps the v2 resource envelope", async () => {
    await withClients(
      (mock) => {
        mock.v2(`/datasets/resources/${IDS.resourceTabular}/`, {
          fixture: "datagouv/resource-tabular-csv",
        });
      },
      async (clients) => {
        const resource = await clients.datagouv.getResource(IDS.resourceTabular);
        expect(resource.id).toBe(IDS.resourceTabular);
        expect(resource.format).toBe("csv");
        expect(resource.datasetId).toBeTruthy();
        expect(resource.url).toMatch(/^https?:\/\//);
      },
    );
  });

  it("listDatasetResources maps the v2 resources page", async () => {
    await withClients(
      (mock) => {
        mock.v2(`/datasets/${IDS.dataset}/resources/`, {
          fixture: "datagouv/dataset-resources-population",
        });
      },
      async (clients) => {
        const page = await clients.datagouv.listDatasetResources(IDS.dataset, 1, 5);
        expect(page.items.length).toBeGreaterThan(0);
        expect(page.items.every((r) => r.datasetId === IDS.dataset)).toBe(true);
        expect(page.pageSize).toBeGreaterThan(0);
      },
    );
  });

  it("searchOrganizations maps v2 org search", async () => {
    await withClients(
      (mock) => {
        mock.v2("/organizations/search/", {
          json: sanitizeOrgPage(loadFixture("datagouv/organizations-search-etalab")),
        });
      },
      async (clients) => {
        const page = await clients.datagouv.searchOrganizations({ query: "etalab", pageSize: 3 });
        expect(
          page.items.some((o) => o.slug === "etalab" || o.name.toLowerCase().includes("etalab")),
        ).toBe(true);
      },
    );
  });

  it("searchDataservices and getDataservice map v2 search + v1 detail", async () => {
    await withClients(
      (mock) => {
        mock.v2("/dataservices/search/", { fixture: "datagouv/dataservices-search-adresse" });
        mock.v1(`/dataservices/${IDS.dataservice}/`, {
          fixture: "datagouv/dataservice-api-adresse",
        });
      },
      async (clients) => {
        const page = await clients.datagouv.searchDataservices({ query: "adresse", pageSize: 3 });
        expect(page.items.length).toBeGreaterThan(0);
        const detail = await clients.datagouv.getDataservice(IDS.dataservice);
        expect(detail.id).toBe(IDS.dataservice);
        expect(detail.title.toLowerCase()).toContain("adresse");
        expect(detail.baseApiUrl).toBeTruthy();
      },
    );
  });

  it("listReuses and getReuse map v1 list + detail from the first recorded reuse", async () => {
    const reuses = loadFixture<{ data: Array<Record<string, unknown>> }>(
      "datagouv/reuses-population",
    );
    const first = reuses.data[0];
    if (!first) throw new Error("reuses-population fixture is empty");

    await withClients(
      (mock) => {
        mock.v1("/reuses/", { fixture: "datagouv/reuses-population" });
        mock.v1(`/reuses/${IDS.reuse}/`, { json: first });
      },
      async (clients) => {
        const page = await clients.datagouv.listReuses({
          datasetId: IDS.dataset,
          pageSize: 3,
        });
        expect(page.items.length).toBeGreaterThan(0);
        const reuse = await clients.datagouv.getReuse(IDS.reuse);
        expect(reuse.id).toBe(IDS.reuse);
        expect(reuse.title.length).toBeGreaterThan(0);
      },
    );
  });

  it("searchTopics and getTopic map v2 search + detail (+ elements page)", async () => {
    await withClients(
      (mock) => {
        mock.v2("/topics/search/", { fixture: "datagouv/topics-search-transport" });
        mock.v2(`/topics/${IDS.topic}/`, { fixture: "datagouv/topic-detail-v2" });
        mock.v2(`/topics/${IDS.topic}/elements/`, { fixture: "datagouv/topic-elements-v2-p1" });
      },
      async (clients) => {
        const page = await clients.datagouv.searchTopics("transport", 1, 3);
        expect(page.items.length).toBeGreaterThan(0);
        const topic = await clients.datagouv.getTopic(IDS.topic);
        expect(topic.id).toBe(IDS.topic);
        expect(topic.elementsCount).toBeGreaterThan(0);
        expect(topic.elements.length).toBeGreaterThan(0);
      },
    );
  });

  it("suggest aggregates recorded autocomplete sources", async () => {
    await withClients(
      (mock) => {
        mock.v1("/datasets/suggest/", { fixture: "datagouv/suggest-datasets-popu" });
        mock.v1("/organizations/suggest/", { fixture: "datagouv/suggest-organizations-insee" });
        mock.v1("/tags/suggest/", { fixture: "datagouv/suggest-tags-tran" });
        mock.v1("/spatial/zones/suggest/", { fixture: "datagouv/suggest-zones-paris" });
      },
      async (clients) => {
        const hits = await clients.datagouv.suggest("popu", 5);
        expect(hits.some((h) => h.kind === "dataset")).toBe(true);
        expect(hits.some((h) => h.kind === "organization")).toBe(true);
        expect(hits.some((h) => h.kind === "tag")).toBe(true);
        expect(hits.some((h) => h.kind === "zone")).toBe(true);
      },
    );
  });
});
