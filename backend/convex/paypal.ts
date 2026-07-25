import {
  PaymentStatus,
  PRODUCT_AMOUNT,
  PRODUCT_CURRENCY,
  PRODUCT_ID,
  PRODUCT_NAME
} from "@minimum-paypal/shared/payment";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  action,
  httpAction,
  internalMutation,
  internalQuery,
  query
} from "./_generated/server";
import { requireEnv } from "./lib/config";
import { jsonResponse } from "./lib/security";

const PAYPAL_RESOURCE_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const PAYPAL_AMOUNT_PATTERN = /^\d{1,32}(?:\.\d{1,2})?$/;
const MAX_WEBHOOK_BODY_BYTES = 1_048_576;
const MAX_WEBHOOK_AGE_MILLISECONDS = 5 * 60 * 1000;
class PayPalProviderError extends Error {}
const paypalAccessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.literal("Bearer")
});
const paypalOrderSchema = z.object({
  id: z.string().regex(PAYPAL_RESOURCE_ID_PATTERN),
  links: z.array(z.object({
    href: z.url(),
    method: z.string().min(1).optional(),
    rel: z.string().min(1)
  })).min(1)
});
const paypalCaptureSchema = z.object({
  purchase_units: z.array(z.object({
    payments: z.object({
      captures: z.array(z.object({
        amount: z.object({
          currency_code: z.string().length(3).regex(/^[A-Z]{3}$/),
          value: z.string().regex(PAYPAL_AMOUNT_PATTERN)
        }),
        id: z.string().regex(PAYPAL_RESOURCE_ID_PATTERN),
        status: z.literal("COMPLETED")
      })).min(1)
    })
  })).min(1),
  status: z.literal("COMPLETED")
});
const paypalWebhookSchema = z.object({
  event_type: z.enum([
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.DECLINED",
    "PAYMENT.CAPTURE.PENDING",
    "PAYMENT.CAPTURE.REFUNDED",
    "PAYMENT.CAPTURE.REVERSED"
  ]),
  id: z.string().min(1),
  resource: z.object({
    amount: z.object({
      currency_code: z.string().length(3).regex(/^[A-Z]{3}$/),
      value: z.string().regex(PAYPAL_AMOUNT_PATTERN)
    }).optional(),
    id: z.string().regex(PAYPAL_RESOURCE_ID_PATTERN).optional(),
    supplementary_data: z.object({
      related_ids: z.object({
        order_id: z.string().regex(PAYPAL_RESOURCE_ID_PATTERN).optional()
      })
    }).optional()
  }).optional()
});
const paypalWebhookVerificationSchema = z.object({
  verification_status: z.enum(["FAILURE", "SUCCESS"])
});
const paypalResponseSchema = z.record(z.string(), z.unknown());
const getOrCreateCheckoutAttemptReference = makeFunctionReference<
  "mutation",
  { userSubject: string },
  Doc<"paypalCheckoutFlows"> | null
>("paypalModel:getOrCreateCheckoutAttempt");
const completeCheckoutAttemptReference = makeFunctionReference<
  "mutation",
  {
    approvalUrl: string;
    checkoutId: Doc<"paypalCheckoutFlows">["_id"];
    paypalOrderId: string;
  },
  null
>("paypalModel:completeCheckoutAttempt");

function paypalEnvironment() {
  const environment = requireEnv("PAYPAL_ENVIRONMENT");
  if (environment !== "sandbox" && environment !== "live") {
    throw new Error("PAYPAL_ENVIRONMENT must be sandbox or live");
  }
  return environment;
}

function paypalBaseUrl() {
  return paypalEnvironment() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

function paypalApprovalHostname() {
  return paypalEnvironment() === "sandbox"
    ? "www.sandbox.paypal.com"
    : "www.paypal.com";
}

function paypalCheckoutUrls() {
  const returnUrl = new URL(requireEnv("PAYPAL_RETURN_URL"));
  const cancelUrl = new URL(requireEnv("PAYPAL_CANCEL_URL"));
  if (
    returnUrl.protocol !== "https:" ||
    cancelUrl.protocol !== "https:" ||
    !returnUrl.hostname.endsWith(".convex.site") ||
    returnUrl.origin !== cancelUrl.origin ||
    returnUrl.pathname !== "/paypal/return" ||
    cancelUrl.pathname !== "/paypal/cancel"
  ) {
    throw new Error(
      "PayPal return and cancel URLs must be matching HTTPS Convex callback origins"
    );
  }
  return { cancelUrl: cancelUrl.toString(), returnUrl: returnUrl.toString() };
}

async function paypalAccessToken() {
  const credentials = btoa(
    `${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`
  );
  // paypalBaseUrl returns one of two hard-coded PayPal API origins.
  // fallow-ignore-next-line security-sink
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const parsedBody = paypalAccessTokenSchema.safeParse(await response.json());
  if (!response.ok || !parsedBody.success) {
    console.error("PayPal authentication failed", { status: response.status });
    throw new PayPalProviderError("PayPal authentication failed");
  }
  return parsedBody.data.access_token;
}

async function paypalRequest({
  path,
  method,
  body,
  requestId
}: {
  path: string;
  method: string;
  body?: unknown;
  requestId?: string;
}) {
  // The origin is fixed by environment and every path is an internal literal.
  // fallow-ignore-next-line security-sink
  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await paypalAccessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = paypalResponseSchema.parse(await response.json());
  if (!response.ok) {
    console.error("PayPal request failed", { path, status: response.status });
    throw new PayPalProviderError("PayPal request failed");
  }
  return payload;
}

async function authenticatedSubject(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity.subject;
}

export const getCheckoutByOrderId = internalQuery({
  args: { paypalOrderId: v.string() },
  async handler(ctx, { paypalOrderId }) {
    return await ctx.db
      .query("paypalCheckoutFlows")
      .withIndex("byPaypalOrderId", (query) =>
        query.eq("paypalOrderId", paypalOrderId)
      )
      .unique();
  }
});

async function completeCheckout(
  ctx: MutationCtx,
  {
    paypalOrderId,
    paypalCaptureId
  }: { paypalOrderId: string; paypalCaptureId: string }
) {
  const flow = await ctx.db
    .query("paypalCheckoutFlows")
    .withIndex("byPaypalOrderId", query =>
      query.eq("paypalOrderId", paypalOrderId)
    )
    .unique();
  if (!flow) {
    return false;
  }

  const now = Date.now();
  await ctx.db.patch(flow._id, {
    status: PaymentStatus.Completed,
    paypalCaptureId,
    capturedAt: now,
    updatedAt: now
  });
  const entitlement = await ctx.db
    .query("entitlements")
    .withIndex("byUserSubjectAndProductId", query =>
      query.eq("userSubject", flow.userSubject).eq("productId", PRODUCT_ID)
    )
    .unique();
  const entitlementValue = {
    userSubject: flow.userSubject,
    productId: PRODUCT_ID,
    isActive: true,
    paypalOrderId,
    paypalCaptureId,
    grantedAt: now
  };
  if (entitlement) {
    await ctx.db.replace(entitlement._id, entitlementValue);
    return true;
  }

  await ctx.db.insert("entitlements", entitlementValue);
  return true;
}

export const recordCapture = internalMutation({
  args: { paypalOrderId: v.string(), paypalCaptureId: v.string() },
  async handler(ctx, { paypalOrderId, paypalCaptureId }) {
    const isCompleted = await completeCheckout(ctx, {
      paypalCaptureId,
      paypalOrderId
    });
    if (!isCompleted) {
      throw new Error("Checkout flow not found");
    }
  }
});

export const cancelCheckout = internalMutation({
  args: { paypalOrderId: v.string() },
  async handler(ctx, { paypalOrderId }) {
    const flow = await ctx.db
      .query("paypalCheckoutFlows")
      .withIndex("byPaypalOrderId", (query) =>
        query.eq("paypalOrderId", paypalOrderId)
      )
      .unique();
    if (flow && flow.status !== PaymentStatus.Completed) {
      await ctx.db.patch(flow._id, {
        status: PaymentStatus.Cancelled,
        updatedAt: Date.now()
      });
    }
  }
});

export const processWebhook = internalMutation({
  args: {
    paypalEventId: v.string(),
    eventType: v.string(),
    paypalOrderId: v.optional(v.string()),
    paypalCaptureId: v.optional(v.string()),
    amount: v.optional(v.string()),
    currency: v.optional(v.string())
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("byPaypalEventId", (query) =>
        query.eq("paypalEventId", args.paypalEventId)
      )
      .unique();
    if (existing) {
      return { isDuplicate: true, shouldRetry: false };
    }
    const { paypalCaptureId, paypalOrderId } = args;
    const isValidCompletedCapture =
      args.eventType === "PAYMENT.CAPTURE.COMPLETED" &&
      paypalOrderId !== undefined &&
      paypalCaptureId !== undefined &&
      args.amount === PRODUCT_AMOUNT &&
      args.currency === PRODUCT_CURRENCY;
    if (!isValidCompletedCapture) {
      await ctx.db.insert("webhookEvents", {
        paypalEventId: args.paypalEventId,
        eventType: args.eventType,
        isVerified: true,
        processedAt: Date.now()
      });
      return { isDuplicate: false, shouldRetry: false };
    }

    const isCompleted = await completeCheckout(ctx, {
      paypalCaptureId,
      paypalOrderId
    });
    if (!isCompleted) {
      return { isDuplicate: false, shouldRetry: true };
    }
    await ctx.db.insert("webhookEvents", {
      paypalEventId: args.paypalEventId,
      eventType: args.eventType,
      isVerified: true,
      processedAt: Date.now()
    });
    return { isDuplicate: false, shouldRetry: false };
  }
});

async function createPaypalOrder(
  attempt: Doc<"paypalCheckoutFlows">,
  userSubject: string
) {
  const checkoutUrls = paypalCheckoutUrls();
  const order = paypalOrderSchema.parse(await paypalRequest({
    path: "/v2/checkout/orders",
    method: "POST",
    requestId: attempt.createRequestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: PRODUCT_ID,
        custom_id: userSubject,
        description: PRODUCT_NAME,
        amount: { currency_code: PRODUCT_CURRENCY, value: PRODUCT_AMOUNT }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: checkoutUrls.returnUrl,
            cancel_url: checkoutUrls.cancelUrl
          }
        }
      }
    }
  }));
  const approvalUrl = order.links.find(
    link => link.rel === "payer-action" || link.rel === "approve"
  )?.href;
  if (!approvalUrl || new URL(approvalUrl).hostname !== paypalApprovalHostname()) {
    throw new Error(
      "PayPal did not return an approval URL for the configured environment"
    );
  }
  return { approvalUrl, paypalOrderId: order.id };
}

export const createCheckout = action({
  args: {},
  async handler(ctx) {
    const userSubject = await authenticatedSubject(ctx);
    const attempt: Doc<"paypalCheckoutFlows"> | null = await ctx.runMutation(
      getOrCreateCheckoutAttemptReference,
      { userSubject }
    );
    if (!attempt) {
      throw new Error("Could not create checkout attempt");
    }
    if (attempt.paypalOrderId && attempt.approvalUrl) {
      return {
        approvalUrl: attempt.approvalUrl,
        checkoutId: attempt._id,
        paypalOrderId: attempt.paypalOrderId
      };
    }

    const { approvalUrl, paypalOrderId } = await createPaypalOrder(
      attempt,
      userSubject
    );
    await ctx.runMutation(
      completeCheckoutAttemptReference,
      {
        checkoutId: attempt._id,
        paypalOrderId,
        approvalUrl
      }
    );
    return { checkoutId: attempt._id, paypalOrderId, approvalUrl };
  }
});

export const entitlementStatus = query({
  args: {},
  async handler(ctx) {
    const userSubject = await authenticatedSubject(ctx);
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("byUserSubjectAndProductId", query =>
        query.eq("userSubject", userSubject).eq("productId", PRODUCT_ID)
      )
      .unique();
    return { isEntitled: entitlement?.isActive === true };
  }
});

export const checkoutStatus = query({
  args: { checkoutId: v.id("paypalCheckoutFlows") },
  async handler(ctx, { checkoutId }) {
    const userSubject = await authenticatedSubject(ctx);
    const flow = await ctx.db.get(checkoutId);
    if (
      !flow ||
      flow.userSubject !== userSubject ||
      !flow.paypalOrderId
    ) {
      return null;
    }
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("byUserSubjectAndProductId", query =>
        query.eq("userSubject", userSubject).eq("productId", PRODUCT_ID)
      )
      .unique();
    return {
      status: flow.status,
      paypalOrderId: flow.paypalOrderId,
      isEntitled: entitlement?.isActive === true,
      updatedAt: flow.updatedAt
    };
  }
});

function checkoutResultPage({ isCompleted }: { isCompleted: boolean }) {
  const title = isCompleted ? "Payment complete" : "Payment cancelled";
  const message = isCompleted
    ? "Return to the page where the extension is open. Your access will update automatically."
    : "No payment was taken. You can close this tab and try again from the extension.";
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${title}</title>
<style>
  body { display: grid; min-height: 100vh; margin: 0; padding: 24px; place-items: center;
    color: #1d1b20; font: 500 16px/1.5 system-ui, sans-serif; background: #fff7ff; }
  main { max-width: 560px; padding: 32px; border-radius: 28px; background: #ece6f0; }
  h1 { margin: 0 0 12px; font-size: 32px; line-height: 1.1; }
  p { margin: 0; color: #49454f; }
</style>
<main><h1>${title}</h1><p>${message}</p></main>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

export const paypalReturn = httpAction(async (ctx, request) => {
  const paypalOrderId = new URL(request.url).searchParams.get("token");
  if (!paypalOrderId) {
    return jsonResponse({ body: { error: "Missing PayPal order token" }, status: 400 });
  }

  try {
    const flow = await ctx.runQuery(internal.paypal.getCheckoutByOrderId, {
      paypalOrderId
    });
    if (!flow) {
      return jsonResponse({ body: { error: "Checkout flow not found" }, status: 404 });
    }
    if (flow.status === PaymentStatus.Cancelled) {
      return jsonResponse({ body: { error: "Checkout was cancelled" }, status: 409 });
    }
    if (flow.status !== PaymentStatus.Completed) {
      const capture = paypalCaptureSchema.parse(await paypalRequest({
        path: `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
        method: "POST",
        requestId: flow.captureRequestId,
        body: {}
      }));
      const capturedPayment = capture.purchase_units[0].payments.captures[0];
      if (
        capture.status !== "COMPLETED" ||
        capturedPayment?.status !== "COMPLETED" ||
        capturedPayment.amount.value !== flow.amount ||
        capturedPayment.amount.currency_code !== flow.currency
      ) {
        throw new Error("PayPal capture did not complete");
      }
      await ctx.runMutation(internal.paypal.recordCapture, {
        paypalOrderId,
        paypalCaptureId: capturedPayment.id
      });
    }
    return checkoutResultPage({ isCompleted: true });
  } catch (error) {
    console.error("PayPal return failed", error);
    return jsonResponse({
      body: { error: "Payment confirmation is temporarily unavailable" },
      status: error instanceof PayPalProviderError ? 502 : 500
    });
  }
});

export const paypalCancel = httpAction(async (ctx, request) => {
  const paypalOrderId =
    new URL(request.url).searchParams.get("token") ?? undefined;
  if (paypalOrderId) {
    await ctx.runMutation(internal.paypal.cancelCheckout, { paypalOrderId });
  }
  return checkoutResultPage({ isCompleted: false });
});

async function readWebhookEvent(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return { ok: false as const, response: jsonResponse({ body: { error: "Payload too large" }, status: 413 }) };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return { ok: false as const, response: jsonResponse({ body: { error: "Payload too large" }, status: 413 }) };
  }

  let rawEvent: unknown;
  try {
    rawEvent = JSON.parse(rawBody);
  } catch {
    return { ok: false as const, response: jsonResponse({ body: { error: "Invalid webhook event" }, status: 400 }) };
  }
  const parsed = paypalWebhookSchema.safeParse(rawEvent);
  return parsed.success
    ? { ok: true as const, event: parsed.data, rawEvent }
    : {
      ok: false as const,
      response: jsonResponse({ body: { error: "Invalid webhook event" }, status: 400 })
    };
}

function readWebhookHeaders(request: Request) {
  const headers = {
    authAlgorithm: request.headers.get("paypal-auth-algo"),
    certificateUrl: request.headers.get("paypal-cert-url"),
    transmissionId: request.headers.get("paypal-transmission-id"),
    transmissionSignature: request.headers.get("paypal-transmission-sig"),
    transmissionTime: request.headers.get("paypal-transmission-time")
  };
  if (Object.values(headers).some(value => !value)) {
    return {
      ok: false as const,
      response: jsonResponse({ body: { error: "Missing signature headers" }, status: 400 })
    };
  }

  const transmissionTimestamp = Date.parse(headers.transmissionTime!);
  if (
    !Number.isFinite(transmissionTimestamp) ||
    Math.abs(Date.now() - transmissionTimestamp) > MAX_WEBHOOK_AGE_MILLISECONDS
  ) {
    return {
      ok: false as const,
      response: jsonResponse({ body: { error: "Stale transmission" }, status: 400 })
    };
  }
  return { ok: true as const, headers };
}

async function verifyWebhookSignature({ headers, rawEvent }: {
  headers: Record<string, string | null>;
  rawEvent: unknown;
}) {
  const verification = paypalWebhookVerificationSchema.parse(await paypalRequest({
    path: "/v1/notifications/verify-webhook-signature",
    method: "POST",
    body: {
      auth_algo: headers.authAlgorithm,
      cert_url: headers.certificateUrl,
      transmission_id: headers.transmissionId,
      transmission_sig: headers.transmissionSignature,
      transmission_time: headers.transmissionTime,
      webhook_id: requireEnv("PAYPAL_WEBHOOK_ID"),
      webhook_event: rawEvent
    }
  }));
  return verification.verification_status === "SUCCESS";
}

export const paypalWebhook = httpAction(async (ctx, request) => {
  const parsedEvent = await readWebhookEvent(request);
  if (!parsedEvent.ok) {
    return parsedEvent.response;
  }
  const parsedHeaders = readWebhookHeaders(request);
  if (!parsedHeaders.ok) {
    return parsedHeaders.response;
  }

  try {
    const isVerified = await verifyWebhookSignature({
      headers: parsedHeaders.headers,
      rawEvent: parsedEvent.rawEvent
    });
    if (!isVerified) {
      return jsonResponse({
        body: { error: "Invalid webhook signature" },
        status: 401
      });
    }
    const webhookEvent = parsedEvent.event;
    const result = await ctx.runMutation(internal.paypal.processWebhook, {
      paypalEventId: webhookEvent.id,
      eventType: webhookEvent.event_type,
      paypalOrderId:
        webhookEvent.resource?.supplementary_data?.related_ids?.order_id,
      paypalCaptureId: webhookEvent.resource?.id,
      amount: webhookEvent.resource?.amount?.value,
      currency: webhookEvent.resource?.amount?.currency_code
    });
    if (result.shouldRetry) {
      return jsonResponse({
        body: { error: "Checkout is not ready for this event" },
        status: 503
      });
    }
    return jsonResponse({ body: result });
  } catch (error) {
    console.error("PayPal webhook processing failed", error);
    return jsonResponse({
      body: { error: "Webhook processing is temporarily unavailable" },
      status: error instanceof PayPalProviderError ? 502 : 500
    });
  }
});
