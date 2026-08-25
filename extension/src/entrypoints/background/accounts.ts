import { type Auth, signOut } from "@firebase/auth/web-extension";

import { type GoogleAccount, googleAccountsSchema } from "@/lib/contracts";
import { getGoogleAccountAuth } from "@/lib/firebase";
import { PaymentErrorKind, PaymentFailure } from "@/lib/payment-error";

const ACCOUNTS_STORAGE_KEY = "local:googleAccounts";
const ACTIVE_ACCOUNT_STORAGE_KEY = "local:activeGoogleSubject";

export async function getGoogleAccounts() {
  const stored = await storage.getItem<GoogleAccount[]>(ACCOUNTS_STORAGE_KEY);
  const parsed = googleAccountsSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

async function saveGoogleAccounts(accounts: GoogleAccount[]) {
  await storage.setItem(ACCOUNTS_STORAGE_KEY, accounts);
}

export async function getActiveGoogleSubject() {
  const activeSubject = await storage.getItem<string>(ACTIVE_ACCOUNT_STORAGE_KEY);
  const accounts = await getGoogleAccounts();
  return accounts.some(account => account.googleSubject === activeSubject)
    ? activeSubject
    : null;
}

export async function getActiveAccountContext(): Promise<{
  auth: Auth;
  googleSubject: string;
} | null> {
  const accounts = await getGoogleAccounts();
  const selectedSubject = await getActiveGoogleSubject();
  const orderedAccounts = selectedSubject
    ? [
      ...accounts.filter(account => account.googleSubject === selectedSubject),
      ...accounts.filter(account => account.googleSubject !== selectedSubject)
    ]
    : accounts;

  for (const account of orderedAccounts) {
    const auth = getGoogleAccountAuth(account.googleSubject);
    await auth.authStateReady();
    if (auth.currentUser) {
      await storage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, account.googleSubject);
      return { auth, googleSubject: account.googleSubject };
    }
  }
  return null;
}

export async function saveGoogleAccount(account: GoogleAccount) {
  const accounts = await getGoogleAccounts();
  const nextAccounts = accounts.filter(
    existing => existing.googleSubject !== account.googleSubject
  );
  nextAccounts.push(account);
  await saveGoogleAccounts(nextAccounts);
  await storage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, account.googleSubject);
}

export async function selectGoogleAccount(googleSubject: string) {
  const accounts = await getGoogleAccounts();
  if (!accounts.some(account => account.googleSubject === googleSubject)) {
    throw new Error("Google account was not found");
  }

  const auth = getGoogleAccountAuth(googleSubject);
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new PaymentFailure(
      PaymentErrorKind.signedOut,
      "Google account session has expired; add it again"
    );
  }
  await storage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, googleSubject);
}

export async function removeGoogleAccount(googleSubject: string) {
  const accounts = await getGoogleAccounts();
  const account = accounts.find(item => item.googleSubject === googleSubject);
  if (!account) {
    return;
  }

  await signOut(getGoogleAccountAuth(googleSubject));
  const remainingAccounts = accounts.filter(
    item => item.googleSubject !== googleSubject
  );
  await saveGoogleAccounts(remainingAccounts);
  await storage.removeItem(`local:purchase:${googleSubject}`);

  if (await getActiveGoogleSubject() === null) {
    const nextSubject = remainingAccounts[0]?.googleSubject;
    if (nextSubject) {
      await storage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, nextSubject);
    } else {
      await storage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    }
  }
}
