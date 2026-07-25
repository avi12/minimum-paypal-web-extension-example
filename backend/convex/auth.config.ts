import type { AuthConfig } from "convex/server";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Missing FIREBASE_PROJECT_ID");
}

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      applicationID: FIREBASE_PROJECT_ID
    }
  ]
} satisfies AuthConfig;
