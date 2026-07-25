import { GoogleAuthProvider, signInWithCredential, signOut } from "@firebase/auth/web-extension";
import { browser } from "wxt/browser";

import { APP_CONFIG, GOOGLE_OAUTH_EXCHANGE_PATH, GOOGLE_OAUTH_START_PATH } from "@/app.config";
import { googleOAuthCallbackSchema, googleOAuthExchangeSchema } from "@/lib/contracts";
import { getGoogleAccountAuth } from "@/lib/firebase";
import { saveGoogleAccount } from "./accounts";

const JSON_CONTENT_TYPE = "application/json";

export async function authenticateWithGoogle() {
  const { oneTimeCode, redirectUrl } = await launchGoogleAuthFlow();
  const exchange = await exchangeGoogleCredential({ oneTimeCode, redirectUrl });
  const credential = GoogleAuthProvider.credential(
    exchange.googleIdToken,
    exchange.googleAccessToken
  );
  const auth = getGoogleAccountAuth(exchange.googleSubject);
  const userCredential = await signInWithCredential(auth, credential);
  const googleProvider = userCredential.user.providerData.find(
    provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID
  );
  if (googleProvider?.uid !== exchange.googleSubject) {
    await signOut(auth);
    throw new Error("Firebase returned a different Google account");
  }
  await saveGoogleAccount({
    displayName: userCredential.user.displayName ?? exchange.displayName ?? null,
    email: userCredential.user.email ?? exchange.email ?? null,
    googleSubject: exchange.googleSubject
  });
}

async function launchGoogleAuthFlow() {
  const redirectUrl = browser.identity.getRedirectURL();
  const startUrl = new URL(GOOGLE_OAUTH_START_PATH, APP_CONFIG.convexSiteUrl);
  startUrl.searchParams.set("redirectUri", redirectUrl);
  const callbackUrl = await browser.identity.launchWebAuthFlow({
    interactive: true,
    url: startUrl.toString()
  });

  if (!callbackUrl) {
    throw new Error("Google sign-in did not return a callback");
  }

  const callback = new URL(callbackUrl);
  const expectedCallback = new URL(redirectUrl);
  if (
    callback.origin !== expectedCallback.origin ||
    callback.pathname !== expectedCallback.pathname
  ) {
    throw new Error("Google sign-in returned an unexpected callback");
  }

  const parsedCallback = googleOAuthCallbackSchema.safeParse({
    oneTimeCode: callback.searchParams.get("code")
  });
  if (!parsedCallback.success) {
    throw new Error(callback.searchParams.get("error") ?? "Google sign-in failed");
  }
  return { oneTimeCode: parsedCallback.data.oneTimeCode, redirectUrl };
}

async function exchangeGoogleCredential({ oneTimeCode, redirectUrl }: {
  oneTimeCode: string;
  redirectUrl: string;
}) {
  // APP_CONFIG derives and validates the Convex .site origin at build time.
  // fallow-ignore-next-line security-sink
  const exchangeResponse = await fetch(
    new URL(GOOGLE_OAUTH_EXCHANGE_PATH, APP_CONFIG.convexSiteUrl),
    {
      body: JSON.stringify({
        code: oneTimeCode,
        redirectUri: redirectUrl
      }),
      headers: { "content-type": JSON_CONTENT_TYPE },
      method: "POST"
    }
  );
  if (!exchangeResponse.ok) {
    throw new Error(`Broker request failed with ${exchangeResponse.status}`);
  }

  return googleOAuthExchangeSchema.parse(await exchangeResponse.json());
}
