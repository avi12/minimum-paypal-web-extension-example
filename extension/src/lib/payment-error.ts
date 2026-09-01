import { checkoutErrorSchema, PaypalErrorCode } from "@minimum-paypal/shared/payment";
import { ConvexError } from "convex/values";

/**
 * What a failure means to the member, which is a smaller set than the codes the
 * backend stamps: several distinct refusals ask the same thing of them. Backing out
 * is not a kind - a member who closes the window is not looking at an error screen.
 */
export enum PaymentErrorKind {
  alreadyOwned = "already_owned",
  network = "network",
  region = "region",
  signedOut = "signed_out",
  unavailable = "unavailable"
}

/**
 * Only two backend refusals are about the member: already owning the product, and a
 * region PayPal will not serve. Everything else - a missing PayPal secret, PayPal's
 * API refusing the create call - is our side failing to reach checkout, and asking
 * the member to fix something for those blames the wrong party.
 */
const ERROR_KIND_BY_CODE: Record<PaypalErrorCode, PaymentErrorKind> = {
  [PaypalErrorCode.alreadyEntitled]: PaymentErrorKind.alreadyOwned,
  [PaypalErrorCode.countryNotSupported]: PaymentErrorKind.region,
  [PaypalErrorCode.paypalError]: PaymentErrorKind.unavailable,
  [PaypalErrorCode.serverMisconfigured]: PaymentErrorKind.unavailable,
  [PaypalErrorCode.unauthorized]: PaymentErrorKind.signedOut
};

// launchWebAuthFlow rejects both when the member closes the window and when it never
// opened at all, and only the first is a cancel. Chrome says "The user did not approve
// access", Firefox "User cancelled or denied access"; anything else - the page refusing
// to load, another auth flow already running - is a real failure, and swallowing it as
// a cancel leaves the button doing visibly nothing.
const USER_CANCELLED_AUTH_FLOW_PATTERN = /cancel|did not approve|denied access/i;

// Conditions the browser itself creates while tearing the extension down: an update,
// reload or disable orphaning a content script that is still on the page, the MV3 worker
// already collected, the browser closing, a message port dropped mid-flight. Every
// extension API the surviving code touches then throws, and no version of it can recover,
// so these are lifecycle events rather than refusals - painting the checkout card with one
// tells the member their payment broke when the only thing that ended was the script
// asking about it. ("No SW" is how wxt/storage words the same teardown, and it arrives
// wrapped in the operation and key `lib/storage.ts` names.) The word boundary keeps a
// genuine failure that merely mentions a service worker reaching the card.
const BROWSER_TEARDOWN_PATTERNS = [
  /context invalidated/i,
  /browser is shutting down/i,
  /\bno sw\b/i,
  /message channel closed/i
];

/**
 * Raised where we can name a failure the backend never saw: a browser that will not
 * open a window, an id token that will not mint offline, a session that has expired.
 */
export class PaymentFailure extends Error {
  constructor(readonly errorKind: PaymentErrorKind, message: string) {
    super(message);
  }
}

function toReason(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isUserCancelledAuthFlow(error: unknown) {
  return USER_CANCELLED_AUTH_FLOW_PATTERN.test(toReason(error));
}

export function isBrowserTeardown(error: unknown) {
  const reason = toReason(error);
  return BROWSER_TEARDOWN_PATTERNS.some(pattern => pattern.test(reason));
}

/**
 * The single place a thrown value becomes a screen. Anything we cannot name reads as
 * `unavailable` rather than borrowing whichever kind last happened to fit.
 */
export function toPaymentErrorKind(error: unknown) {
  if (error instanceof PaymentFailure) {
    return error.errorKind;
  }

  const parsedError = error instanceof ConvexError
    ? checkoutErrorSchema.safeParse(error.data)
    : null;
  return parsedError?.success
    ? ERROR_KIND_BY_CODE[parsedError.data.code]
    : PaymentErrorKind.unavailable;
}
