import { PaymentStatus } from "@minimum-paypal/shared/payment";
import type { PaymentErrorKind } from "@/lib/payment-error";
import { z } from "@/lib/zod";

export {
  checkoutSchema,
  checkoutStatusSchema,
  entitlementStatusSchema,
  PaymentStatus
} from "@minimum-paypal/shared/payment";
export type { Checkout } from "@minimum-paypal/shared/payment";

export const googleOAuthExchangeSchema = z.object({
  displayName: z.string().min(1).nullable().optional(),
  email: z.email().nullable().optional(),
  googleAccessToken: z.string().min(1),
  googleIdToken: z.string().min(1),
  googleSubject: z.string().min(1).max(255)
});

export const googleOAuthCallbackSchema = z.object({
  oneTimeCode: z.string().min(1)
});

export const storedPurchaseSchema = z.object({
  checkoutId: z.string().min(1),
  paypalOrderId: z.string().min(1),
  status: z.enum(PaymentStatus)
});
export type StoredPurchase = z.infer<typeof storedPurchaseSchema>;

const googleAccountSchema = z.object({
  displayName: z.string().nullable(),
  email: z.email().nullable(),
  googleSubject: z.string().min(1).max(255)
}).strict();
export const googleAccountsSchema = z.array(googleAccountSchema).refine(
  accounts =>
    new Set(accounts.map(account => account.googleSubject)).size ===
    accounts.length,
  "Google account subjects must be unique"
);
export type GoogleAccount = z.infer<typeof googleAccountSchema>;

export interface ExtensionUser {
  displayName: string | null;
  email: string | null;
  googleSubject: string;
}

export interface ExtensionState {
  accounts: GoogleAccount[];
  activeGoogleSubject: string | null;
  isEntitled: boolean;
  purchase: StoredPurchase | null;
  user: ExtensionUser | null;
}

/**
 * Starting a purchase answers with state either way: a refused checkout still has to
 * repaint the card, and throwing across the messaging boundary would strip the kind
 * off the error on its way to the content script.
 */
export interface PurchaseResult {
  errorKind: PaymentErrorKind | null;
  state: ExtensionState;
}
