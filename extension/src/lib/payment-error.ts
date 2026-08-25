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

/**
 * Raised where we can name a failure the backend never saw: a browser that will not
 * open a window, an id token that will not mint offline, a session that has expired.
 */
export class PaymentFailure extends Error {
  constructor(readonly errorKind: PaymentErrorKind, message: string) {
    super(message);
  }
}

export function isUserCancelledAuthFlow(error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  return USER_CANCELLED_AUTH_FLOW_PATTERN.test(reason);
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
