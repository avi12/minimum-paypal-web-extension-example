import type { CheckoutError, PaypalErrorCode } from "@minimum-paypal/shared/payment";
import { ConvexError } from "convex/values";

/**
 * Convex redacts a plain Error's message in production, so `data` on a ConvexError
 * is the only failure detail that survives the wire. Naming the refusal with a code
 * both workspaces share is what lets the extension pick the matching screen instead
 * of reading every refusal as the same dead end.
 */
export function checkoutError(code: PaypalErrorCode) {
  return new ConvexError({ code } satisfies CheckoutError);
}
