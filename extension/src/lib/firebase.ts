import { getApps, initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth/web-extension";

import { APP_CONFIG } from "@/app.config";

export function getGoogleAccountAuth(googleSubject: string) {
  const appName = `google-${googleSubject}`;
  const firebaseApp =
    getApps().find(app => app.name === appName) ??
    initializeApp(APP_CONFIG.firebase, appName);
  return getAuth(firebaseApp);
}
