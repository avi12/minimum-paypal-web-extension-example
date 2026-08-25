import { makeFunctionReference } from "convex/server";
import { browser } from "wxt/browser";

import { CREATE_CHECKOUT_FUNCTION, GET_CHECKOUT_STATUS_FUNCTION, GET_ENTITLEMENT_STATUS_FUNCTION } from "@/app.config";
import {
  type Checkout,
  checkoutSchema,
  checkoutStatusSchema,
  entitlementStatusSchema,
  type GoogleAccount,
  PaymentStatus,
  type PurchaseResult,
  type StoredPurchase,
  storedPurchaseSchema
} from "@/lib/contracts";
import { PaymentErrorKind, PaymentFailure, toPaymentErrorKind } from "@/lib/payment-error";
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
  try {
    return await getSignedInState(accounts);
  } catch (error) {
    // Repainting the card is what tells the member they are signed out, so a session
    // that will not open - or an entitlement query that cannot reach Convex - has to
    // answer with a state rather than take the whole card down with it.
    console.warn("Could not read the signed-in state", error);
    return {
      accounts,
      activeGoogleSubject: null,
      isEntitled: false,
      purchase: null,
      user: null
    };
  }
}

async function getSignedInState(accounts: GoogleAccount[]) {
  const authenticated = await createAuthenticatedConvexClient();
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

export async function startLifetimePurchase(): Promise<PurchaseResult> {
  try {
    await openCheckout();
    return { errorKind: null, state: await getExtensionState() };
  } catch (error) {
    // The backend names why it refused; anything it did not name reads as "we could
    // not reach checkout", which is the honest answer and says nothing about the
    // member's payment method.
    console.error("Could not start the PayPal checkout", error);
    return {
      errorKind: toPaymentErrorKind(error),
      state: await getExtensionState()
    };
  }
}

async function openCheckout() {
  const authenticated = await createAuthenticatedConvexClient();
  const checkout = checkoutSchema.parse(
    await authenticated.client.action(createCheckout, {})
  );
  await savePurchase(authenticated.googleSubject, {
    checkoutId: checkout.checkoutId,
    paypalOrderId: checkout.paypalOrderId,
    status: PaymentStatus.Created
  });
  await openApprovalTab(checkout.approvalUrl);
}

/**
 * The order already exists by the time the tab opens, so a browser that refuses to
 * open one - no window to attach to, a policy blocking the navigation - leaves a real
 * pending checkout with nothing on screen. Saying so is the difference between that
 * and a button that visibly does nothing; the member gets back to the same order by
 * starting again, which reuses the pending attempt rather than creating a second one.
 */
async function openApprovalTab(approvalUrl: string) {
  try {
    await browser.tabs.create({ url: approvalUrl });
  } catch (error) {
    console.error("Could not open the PayPal approval tab", error);
    throw new PaymentFailure(
      PaymentErrorKind.unavailable,
      "Could not open the PayPal approval tab"
    );
  }
}
