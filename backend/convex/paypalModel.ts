import {
  PaymentStatus,
  PaypalErrorCode,
  PRODUCT_AMOUNT,
  PRODUCT_CURRENCY,
  PRODUCT_ID
} from "@minimum-paypal/shared/payment";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { checkoutError } from "./lib/checkoutError";

export const getOrCreateCheckoutAttempt = internalMutation({
  args: {
    userSubject: v.string()
  },
  async handler(ctx, { userSubject }) {
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("byUserSubjectAndProductId", query =>
        query.eq("userSubject", userSubject).eq("productId", PRODUCT_ID)
      )
      .unique();
    if (entitlement?.isActive) {
      throw checkoutError(PaypalErrorCode.alreadyEntitled);
    }

    const existing = await ctx.db
      .query("paypalCheckoutFlows")
      .withIndex("byUserSubject", query => query.eq("userSubject", userSubject))
      .order("desc")
      .first();
    if (existing?.status === PaymentStatus.Created) {
      return existing;
    }

    const now = Date.now();
    const checkoutId = await ctx.db.insert("paypalCheckoutFlows", {
      userSubject,
      status: PaymentStatus.Created,
      amount: PRODUCT_AMOUNT,
      currency: PRODUCT_CURRENCY,
      createRequestId: crypto.randomUUID(),
      captureRequestId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    });
    return await ctx.db.get(checkoutId);
  }
});

export const completeCheckoutAttempt = internalMutation({
  args: {
    checkoutId: v.id("paypalCheckoutFlows"),
    paypalOrderId: v.string(),
    approvalUrl: v.string()
  },
  async handler(ctx, { approvalUrl, checkoutId, paypalOrderId }) {
    await ctx.db.patch(checkoutId, {
      approvalUrl,
      paypalOrderId,
      updatedAt: Date.now()
    });
  }
});
