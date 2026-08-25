import { z } from "zod";

export enum PaymentStatus {
  Cancelled = "CANCELLED",
  Completed = "COMPLETED",
  Created = "CREATED"
}

export const PRODUCT_AMOUNT = "9.99";
export const PRODUCT_CURRENCY = "USD";
export const PRODUCT_ID = "extension-premium";
export const PRODUCT_NAME = "Extension Premium";

export const checkoutSchema = z.object({
  approvalUrl: z.url(),
  checkoutId: z.string().min(1),
  paypalOrderId: z.string().min(1)
});

export const checkoutStatusSchema = z.object({
  isEntitled: z.boolean(),
  paypalOrderId: z.string().min(1),
  status: z.enum(PaymentStatus),
  updatedAt: z.number()
});

export const entitlementStatusSchema = z.object({
  isEntitled: z.boolean()
});

export type Checkout = z.infer<typeof checkoutSchema>;

/**
 * Machine-readable reason the backend refused to open a checkout. It rides in the
 * `data` of the ConvexError thrown by `paypal:createCheckout`, so the string values
 * are the wire contract between the two workspaces - keep them byte-identical.
 * A refusal with no code is a bug on our side, not a statement about the payment.
 */
export enum PaypalErrorCode {
  alreadyEntitled = "already_entitled",
  countryNotSupported = "country_not_supported",
  paypalError = "paypal_error",
  serverMisconfigured = "server_misconfigured",
  unauthorized = "unauthorized"
}

export const checkoutErrorSchema = z.object({
  code: z.enum(PaypalErrorCode)
});
export type CheckoutError = z.infer<typeof checkoutErrorSchema>;
