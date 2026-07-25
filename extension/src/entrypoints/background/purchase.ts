import { makeFunctionReference } from "convex/server";
import { browser } from "wxt/browser";

import { CREATE_CHECKOUT_FUNCTION, GET_CHECKOUT_STATUS_FUNCTION, GET_ENTITLEMENT_STATUS_FUNCTION } from "@/app.config";
import {
  type Checkout,
  checkoutSchema,
  checkoutStatusSchema,
  entitlementStatusSchema,
  PaymentStatus,
  type StoredPurchase,
  storedPurchaseSchema
} from "@/lib/contracts";
import { getGoogleAccounts } from "./accounts";
import { createAuthenticatedConvexClient } from "./convex-client";

const createCheckout = makeFunctionReference<
  "action",
  Record<string, never>,
  Checkout
>(CREATE_CHECKOUT_FUNCTION);
const getCheckoutStatus = makeFunctionReference<
  "query",
  { checkoutId: string },
  unknown
>(GET_CHECKOUT_STATUS_FUNCTION);
const getEntitlementStatus = makeFunctionReference<
  "query",
  Record<string, never>,
  unknown
>(GET_ENTITLEMENT_STATUS_FUNCTION);

const purchaseStorageKey = (googleSubject: string) =>
  `local:purchase:${googleSubject}` as const;

async function getStoredPurchase(googleSubject: string) {
  const purchase = await storage.getItem<StoredPurchase>(
    purchaseStorageKey(googleSubject)
  );
  const parsed = storedPurchaseSchema.safeParse(purchase);
  return parsed.success ? parsed.data : null;
}

const savePurchase = (googleSubject: string, purchase: StoredPurchase) =>
  storage.setItem(purchaseStorageKey(googleSubject), purchase);

export async function getExtensionState() {
  const accounts = await getGoogleAccounts();
  let authenticated;
  try {
    authenticated = await createAuthenticatedConvexClient();
  } catch {
    return {
      accounts,
      activeGoogleSubject: null,
      isEntitled: false,
      purchase: null,
      user: null
    };
  }

  const entitlement = entitlementStatusSchema.parse(
    await authenticated.client.query(getEntitlementStatus, {})
  );
  return {
    accounts,
    activeGoogleSubject: authenticated.googleSubject,
    isEntitled: entitlement.isEntitled,
    purchase: await getStoredPurchase(authenticated.googleSubject),
    user: {
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
      googleSubject: authenticated.googleSubject
    }
  };
}

export async function refreshPurchase() {
  const authenticated = await createAuthenticatedConvexClient();
  const googleSubject = authenticated.googleSubject;
  const purchase = await getStoredPurchase(googleSubject);
  if (!purchase) {
    return getExtensionState();
  }

  const refreshedStatus = checkoutStatusSchema.nullable().parse(
    await authenticated.client.query(getCheckoutStatus, {
      checkoutId: purchase.checkoutId
    })
  );
  if (!refreshedStatus) {
    throw new Error("Checkout was not found");
  }

  await savePurchase(googleSubject, {
    checkoutId: purchase.checkoutId,
    paypalOrderId: refreshedStatus.paypalOrderId,
    status: refreshedStatus.isEntitled
      ? PaymentStatus.Completed
      : refreshedStatus.status
  });
  return getExtensionState();
}

export async function startLifetimePurchase() {
  const authenticated = await createAuthenticatedConvexClient();
  const checkout = checkoutSchema.parse(
    await authenticated.client.action(createCheckout, {})
  );
  await savePurchase(authenticated.googleSubject, {
    checkoutId: checkout.checkoutId,
    paypalOrderId: checkout.paypalOrderId,
    status: PaymentStatus.Created
  });
  await browser.tabs.create({ url: checkout.approvalUrl });
  return getExtensionState();
}
