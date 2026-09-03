import { describe, expect, it } from "vitest";
import { IDS, withClients } from "./harness.js";

describe("HttpCrawlerClient (offline fixtures)", () => {
  it("getResourceExceptions and isException use the recorded list", async () => {
    await withClients(
      (mock) => {
        mock.crawler("/resources-exceptions", { fixture: "crawler/resources-exceptions" });
      },
      async (clients) => {
        const ids = await clients.crawler.getResourceExceptions();
        expect(ids.has(IDS.resourceLargeCsv)).toBe(true);
        await expect(clients.crawler.isException(IDS.resourceLargeCsv)).resolves.toBe(true);
        await expect(clients.crawler.isException(IDS.resourceTabular)).resolves.toBe(false);
      },
    );
  });
});
