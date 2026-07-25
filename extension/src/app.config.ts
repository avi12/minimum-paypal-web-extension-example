import { getConvexSiteUrl } from "@/lib/convex-endpoint";
import { z } from "@/lib/zod";

const appEnvironmentSchema = z.object({
  WXT_CONVEX_URL: z.string().url(),
  WXT_FIREBASE_API_KEY: z.string().min(1),
  WXT_FIREBASE_APP_ID: z.string().min(1),
  WXT_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  WXT_FIREBASE_PROJECT_ID: z.string().min(1)
});

const appEnvironment = appEnvironmentSchema.parse(import.meta.env);

export const APP_CONFIG = {
  convexSiteUrl: getConvexSiteUrl(appEnvironment.WXT_CONVEX_URL),
  convexUrl: appEnvironment.WXT_CONVEX_URL,
  firebase: {
    apiKey: appEnvironment.WXT_FIREBASE_API_KEY,
    appId: appEnvironment.WXT_FIREBASE_APP_ID,
    authDomain: appEnvironment.WXT_FIREBASE_AUTH_DOMAIN,
    projectId: appEnvironment.WXT_FIREBASE_PROJECT_ID
  }
} as const;

export const GOOGLE_OAUTH_START_PATH = "/oauth/google/start";
export const GOOGLE_OAUTH_EXCHANGE_PATH = "/oauth/google/exchange";
export const CREATE_CHECKOUT_FUNCTION = "paypal:createCheckout";
export const GET_CHECKOUT_STATUS_FUNCTION = "paypal:checkoutStatus";
export const GET_ENTITLEMENT_STATUS_FUNCTION = "paypal:entitlementStatus";
