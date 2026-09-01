import { describe, expect, it } from "vitest";

import { isBrowserTeardown, isUserCancelledAuthFlow } from "./payment-error";

describe("isBrowserTeardown", () => {
  // The whole family means one thing: the browser is tearing the extension down around
  // live code. The first arrives through `lib/storage.ts`, which wraps the native
  // message in the operation and key it was doing at the time.
  it.each([
    "storage read \"local:purchase:google-subject-1\": No SW",
    "storage write \"local:googleAccounts\": The browser is shutting down.",
    "Extension context invalidated.",
    "A listener indicated an asynchronous response by returning true, but the message channel closed"
  ])("reads %s as a teardown", reason => {
    expect(isBrowserTeardown(new Error(reason))).toBe(true);
  });

  it("still reads a failure that only mentions a service worker as a failure", () => {
    expect(isBrowserTeardown(new Error("could not register nosworker.js"))).toBe(false);
  });

  it("leaves a refusal that reached us from the backend alone", () => {
    expect(isBrowserTeardown(new Error("PayPal refused to create the order"))).toBe(false);
  });

  it("reads a thrown non-error", () => {
    expect(isBrowserTeardown("Extension context invalidated")).toBe(true);
  });
});

describe("isUserCancelledAuthFlow", () => {
  it.each([
    "The user did not approve access.",
    "User cancelled or denied access."
  ])("reads %s as backing out", reason => {
    expect(isUserCancelledAuthFlow(new Error(reason))).toBe(true);
  });

  it("leaves a window that never opened as a failure", () => {
    expect(isUserCancelledAuthFlow(new Error("Authorization page could not be loaded."))).toBe(false);
  });
});
