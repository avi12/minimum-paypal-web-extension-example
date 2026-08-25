import { PaymentErrorKind } from "@/lib/payment-error";

interface PaymentErrorCopy {
  /** Whether offering the buy button again can plausibly get anywhere. */
  canRetry: boolean;
  message: string;
  title: string;
}

/**
 * One entry per kind, so a new kind cannot ship without someone deciding what it says
 * and whether retrying helps. None of these blame the member's payment method: the
 * card is never charged before PayPal's own approval page, so nothing here can be a
 * decline.
 */
export const PAYMENT_ERROR_COPY: Record<PaymentErrorKind, PaymentErrorCopy> = {
  [PaymentErrorKind.alreadyOwned]: {
    canRetry: false,
    message: "This account already has lifetime access. Refresh to pull it in.",
    title: "You already own it"
  },
  [PaymentErrorKind.network]: {
    canRetry: true,
    message: "We could not reach the server. Check your connection and try again.",
    title: "No connection"
  },
  [PaymentErrorKind.region]: {
    canRetry: false,
    message: "PayPal does not support checkout in your country yet.",
    title: "PayPal cannot check out here"
  },
  [PaymentErrorKind.signedOut]: {
    canRetry: false,
    message: "Your Google session expired. Add the account again to continue.",
    title: "Sign in again"
  },
  [PaymentErrorKind.unavailable]: {
    canRetry: true,
    message: "Something on our side stopped it. You were not charged.",
    title: "Checkout could not start"
  }
};
