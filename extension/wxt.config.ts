import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  modules: ["@wxt-dev/module-svelte"],
  srcDir: "src",
  manifest: ({ browser }) => ({
    name: "Minimum PayPal Example",
    description: "A minimal lifetime purchase flow backed by Convex",
    permissions: ["identity", "storage"],
    host_permissions: ["https://*/*"],
    key:
      browser === "chrome"
        ? import.meta.env.WXT_CHROME_EXTENSION_KEY || undefined
        : undefined,
    browser_specific_settings:
      browser === "firefox"
        ? {
          gecko: {
            data_collection_permissions: {
              required: [
                "authenticationInfo",
                "financialAndPaymentInfo",
                "personallyIdentifyingInfo"
              ]
            },
            id:
                import.meta.env.WXT_FIREFOX_EXTENSION_ID ||
                "minimum-paypal-example@local.invalid"
          }
        }
        : undefined
  })
});
