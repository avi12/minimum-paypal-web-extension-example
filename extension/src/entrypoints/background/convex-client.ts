import { ConvexHttpClient } from "convex/browser";

import { APP_CONFIG } from "@/app.config";
import { getActiveAccountContext } from "./accounts";

export async function createAuthenticatedConvexClient() {
  const context = await getActiveAccountContext();
  const user = context?.auth.currentUser;

  if (!user) {
    throw new Error("Sign in before starting a purchase");
  }

  const client = new ConvexHttpClient(APP_CONFIG.convexUrl);
  client.setAuth(await user.getIdToken());
  return {
    client,
    googleSubject: context.googleSubject,
    user
  };
}
