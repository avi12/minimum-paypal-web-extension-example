import { describe, expect, it } from "vitest";

import { googleAccountsSchema } from "./contracts";

const account = {
  displayName: "Example User",
  email: "user@example.com",
  googleSubject: "google-subject-1"
};

describe("googleAccountsSchema", () => {
  it("accepts public account metadata", () => {
    expect(googleAccountsSchema.parse([account])).toEqual([account]);
  });

  it("rejects duplicate Google subjects", () => {
    expect(() => googleAccountsSchema.parse([account, account])).toThrow(
      "Google account subjects must be unique"
    );
  });

  it("rejects credential fields", () => {
    expect(() =>
      googleAccountsSchema.parse([{ ...account, refreshToken: "secret" }])
    ).toThrow();
  });
});
