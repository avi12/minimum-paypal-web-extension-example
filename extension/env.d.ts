/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_CHROME_EXTENSION_KEY?: string;
  readonly WXT_CONVEX_URL: string;
  readonly WXT_FIREBASE_API_KEY: string;
  readonly WXT_FIREBASE_APP_ID: string;
  readonly WXT_FIREBASE_AUTH_DOMAIN: string;
  readonly WXT_FIREBASE_PROJECT_ID: string;
  readonly WXT_FIREFOX_EXTENSION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
