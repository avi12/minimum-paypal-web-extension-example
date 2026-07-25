import { PaymentStatus } from "@minimum-paypal/shared/payment";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const paymentStatusValidator = v.union(
  v.literal(PaymentStatus.Cancelled),
  v.literal(PaymentStatus.Completed),
  v.literal(PaymentStatus.Created)
);

export default defineSchema({
  oauthTransactions: defineTable({
    stateHash: v.string(),
    codeVerifier: v.string(),
    nonce: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number())
  }).index("byStateHash", ["stateHash"]),

  googleCredentialExchanges: defineTable({
    codeHash: v.string(),
    redirectUri: v.string(),
    googleIdToken: v.string(),
    googleAccessToken: v.string(),
    googleSubject: v.optional(v.string()),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number())
  }).index("byCodeHash", ["codeHash"]),

  paypalCheckoutFlows: defineTable({
    userSubject: v.string(),
    paypalOrderId: v.optional(v.string()),
    status: paymentStatusValidator,
    amount: v.string(),
    currency: v.string(),
    approvalUrl: v.optional(v.string()),
    createRequestId: v.string(),
    captureRequestId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    paypalCaptureId: v.optional(v.string()),
    capturedAt: v.optional(v.number())
  })
    .index("byPaypalOrderId", ["paypalOrderId"])
    .index("byUserSubject", ["userSubject"]),

  webhookEvents: defineTable({
    paypalEventId: v.string(),
    eventType: v.string(),
    isVerified: v.boolean(),
    processedAt: v.number()
  }).index("byPaypalEventId", ["paypalEventId"]),

  entitlements: defineTable({
    userSubject: v.string(),
    productId: v.string(),
    isActive: v.boolean(),
    paypalOrderId: v.string(),
    paypalCaptureId: v.string(),
    grantedAt: v.number()
  })
    .index("byUserSubjectAndProductId", ["userSubject", "productId"])
    .index("byPaypalOrderId", ["paypalOrderId"])
});
