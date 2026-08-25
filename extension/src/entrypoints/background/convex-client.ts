import type { User } from "@firebase/auth/web-extension";
import { ConvexHttpClient } from "convex/browser";

import { APP_CONFIG } from "@/app.config";
import { PaymentErrorKind, PaymentFailure } from "@/lib/payment-error";
import { getActiveAccountContext } from "./accounts";

export async function createAuthenticatedConvexClient() {
  const context = await getActiveAccountContext();
  const user = context?.auth.currentUser;

  if (!user) {
    throw new PaymentFailure(
      PaymentErrorKind.signedOut,
      "Sign in before starting a purchase"
    );
  }

  const client = new ConvexHttpClient(APP_CONFIG.convexUrl);
  client.setAuth(await mintIdToken(user));
  return {
    client,
    googleSubject: context.googleSubject,
    user
  };
}

/**
 * Minting fails for something as ordinary as being offline
 * (auth/network-request-failed), and letting that raw Firebase code reach the card
 * told the member their sign-in was broken when their connection was. The session is
 * still good, so this is a network failure, not a signed-out one.
 */
async function mintIdToken(user: User) {
  try {
    return await user.getIdToken();
  } catch (error) {
    console.warn("Could not mint a Firebase id token", error);
    throw new PaymentFailure(
      PaymentErrorKind.network,
      "Could not mint a Firebase id token"
    );
  }
}
