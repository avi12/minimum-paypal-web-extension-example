import { describe, expect, it } from "vitest";

import { getConvexSiteUrl } from "./convex-endpoint";

describe("getConvexSiteUrl", () => {
  it("derives the hosted HTTP action origin", () => {
    expect(getConvexSiteUrl("https://example.convex.cloud")).toBe(
      "https://example.convex.site"
    );
  });

  it("derives the local HTTP action port", () => {
    expect(getConvexSiteUrl("http://127.0.0.1:3210")).toBe(
      "http://127.0.0.1:3211"
    );
  });

  it("rejects unrelated deployment origins", () => {
    expect(() => getConvexSiteUrl("https://example.com")).toThrow(
      "WXT_CONVEX_URL must be a Convex cloud or local deployment URL"
    );
  });
});
