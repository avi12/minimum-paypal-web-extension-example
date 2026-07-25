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
