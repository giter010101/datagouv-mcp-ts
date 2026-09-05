import { describe, expect, it } from "vitest";
import { cleanSearchQuery } from "./search-query.js";

describe("cleanSearchQuery", () => {
  it("removes generic French stop words case-insensitively", () => {
    expect(cleanSearchQuery("Données population CSV")).toBe("population");
    expect(cleanSearchQuery("fichier   des   communes")).toBe("des communes");
  });

  it("keeps meaningful queries unchanged", () => {
    expect(cleanSearchQuery("radars automatiques")).toBe("radars automatiques");
  });

  it("returns an empty string when everything was a stop word", () => {
    expect(cleanSearchQuery("données csv")).toBe("");
  });
});
