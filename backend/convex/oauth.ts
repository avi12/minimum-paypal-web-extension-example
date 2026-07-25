import { v } from "convex/values";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalMutation,
  internalQuery
} from "./_generated/server";
import {
  assertAllowed,
  CREDENTIAL_EXCHANGE_TTL_MS,
  OAUTH_TRANSACTION_TTL_MS,
  requireEnv
} from "./lib/config";
import {
  errorMessage,
  jsonResponse,
  randomSecret,
  sha256
} from "./lib/security";

const googleTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  id_token: z.jwt(),
  scope: z.string().min(1),
  token_type: z.literal("Bearer")
});
const googleIdTokenClaimsSchema = z.object({
  email: z.email().optional(),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  iss: z.enum(["https://accounts.google.com", "accounts.google.com"]),
  name: z.string().min(1).max(255).optional(),
  nonce: z.string().min(1),
  sub: z.string().min(1).max(255)
});
const googleExchangeRequestSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.url()
});
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export const createTransaction = internalMutation({
  args: {
    stateHash: v.string(),
    codeVerifier: v.string(),
    nonce: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number()
  },
  async handler(ctx, args) {
    await ctx.db.insert("oauthTransactions", {
      ...args,
      createdAt: Date.now()
    });
  }
});

export const getTransaction = internalQuery({
  args: { stateHash: v.string() },
  async handler(ctx, { stateHash }) {
    return await ctx.db
      .query("oauthTransactions")
      .withIndex("byStateHash", (query) => query.eq("stateHash", stateHash))
      .unique();
  }
});

export const completeTransaction = internalMutation({
  args: {
    transactionId: v.id("oauthTransactions"),
    codeHash: v.string(),
    googleIdToken: v.string(),
    googleAccessToken: v.string(),
    googleSubject: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    expiresAt: v.number()
  },
  async handler(ctx, args) {
    const transaction = await ctx.db.get(args.transactionId);
    const now = Date.now();
    if (
      !transaction ||
      transaction.consumedAt ||
      transaction.expiresAt <= now
    ) {
      throw new Error("OAuth transaction is invalid or expired");
    }
    await ctx.db.patch(transaction._id, { consumedAt: now });
    await ctx.db.insert("googleCredentialExchanges", {
      codeHash: args.codeHash,
      redirectUri: transaction.redirectUri,
      googleIdToken: args.googleIdToken,
      googleAccessToken: args.googleAccessToken,
      googleSubject: args.googleSubject,
      email: args.email,
      displayName: args.displayName,
      expiresAt: args.expiresAt,
      createdAt: now
    });
  }
});

export const consumeCredentialExchange = internalMutation({
  args: { codeHash: v.string(), redirectUri: v.string() },
  async handler(ctx, { codeHash, redirectUri }) {
    const exchange = await ctx.db
      .query("googleCredentialExchanges")
      .withIndex("byCodeHash", (query) => query.eq("codeHash", codeHash))
      .unique();
    const now = Date.now();
    if (
      !exchange ||
      exchange.consumedAt ||
      exchange.expiresAt <= now ||
      exchange.redirectUri !== redirectUri
    ) {
      throw new Error("Credential exchange is invalid or expired");
    }
    await ctx.db.patch(exchange._id, { consumedAt: now });
    return {
      googleIdToken: exchange.googleIdToken,
      googleAccessToken: exchange.googleAccessToken,
      googleSubject: exchange.googleSubject,
      email: exchange.email,
      displayName: exchange.displayName
    };
  }
});

export const googleStart = httpAction(async (ctx, request) => {
  try {
    const redirectUri = new URL(request.url).searchParams.get("redirectUri");
    if (!redirectUri) {
      return jsonResponse({
        body: { error: "redirectUri is required" },
        status: 400
      });
    }
    assertAllowed({ value: redirectUri, envName: "EXTENSION_REDIRECT_URIS" });

    const state = randomSecret();
    const codeVerifier = randomSecret(48);
    const nonce = randomSecret();
    const codeChallenge = await sha256(codeVerifier);
    await ctx.runMutation(internal.oauth.createTransaction, {
      stateHash: await sha256(state),
      codeVerifier,
      nonce,
      redirectUri,
      expiresAt: Date.now() + OAUTH_TRANSACTION_TTL_MS
    });

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.search = new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: requireEnv("GOOGLE_OAUTH_CALLBACK_URL"),
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "online",
      prompt: "select_account"
    }).toString();
    // Fixed Google origin; only server-generated OAuth parameters vary.
    // fallow-ignore-next-line security-sink
    return Response.redirect(googleUrl, 302);
  } catch (error) {
    return jsonResponse({ body: { error: errorMessage(error) }, status: 400 });
  }
});

async function exchangeGoogleCode({ authorizationCode, codeVerifier }: {
  authorizationCode: string;
  codeVerifier: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: authorizationCode,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_OAUTH_CALLBACK_URL"),
      grant_type: "authorization_code",
      code_verifier: codeVerifier
    })
  });
  const parsed = googleTokenSchema.safeParse(await response.json());
  if (!response.ok || !parsed.success) {
    throw new Error("Google token exchange failed");
  }
  return parsed.data;
}

async function verifyGoogleToken(idToken: string, nonce: string) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    algorithms: ["RS256"],
    audience: requireEnv("GOOGLE_CLIENT_ID"),
    clockTolerance: 5,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    maxTokenAge: "10m",
    requiredClaims: ["exp", "iat", "iss", "nonce", "sub"]
  });
  const parsed = googleIdTokenClaimsSchema.safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.exp * 1000 <= Date.now() ||
    parsed.data.nonce !== nonce
  ) {
    throw new Error("Google ID token validation failed");
  }
  return parsed.data;
}

export const googleCallback = httpAction(async (ctx, request) => {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const authorizationCode = url.searchParams.get("code");
    if (!state || !authorizationCode) {
      throw new Error(
        url.searchParams.get("error") ?? "Missing OAuth callback parameters"
      );
    }

    const transaction = await ctx.runQuery(internal.oauth.getTransaction, {
      stateHash: await sha256(state)
    });
    if (
      !transaction ||
      transaction.consumedAt ||
      transaction.expiresAt <= Date.now()
    ) {
      throw new Error("OAuth transaction is invalid or expired");
    }

    const tokens = await exchangeGoogleCode({
      authorizationCode,
      codeVerifier: transaction.codeVerifier
    });
    const claims = await verifyGoogleToken(tokens.id_token, transaction.nonce);

    const handoffCode = randomSecret();
    await ctx.runMutation(internal.oauth.completeTransaction, {
      transactionId: transaction._id,
      codeHash: await sha256(handoffCode),
      googleIdToken: tokens.id_token,
      googleAccessToken: tokens.access_token,
      googleSubject: claims.sub,
      email: claims.email,
      displayName: claims.name,
      expiresAt: Date.now() + CREDENTIAL_EXCHANGE_TTL_MS
    });
    const redirectUrl = new URL(transaction.redirectUri);
    redirectUrl.searchParams.set("code", handoffCode);
    // The exact extension URL was allowlisted before being stored and is redirect-bound.
    // fallow-ignore-next-line security-sink
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    return jsonResponse({ body: { error: errorMessage(error) }, status: 400 });
  }
});

export const googleExchange = httpAction(async (ctx, request) => {
  try {
    const parsedBody = googleExchangeRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return jsonResponse({
        body: { error: "code and redirectUri are required" },
        status: 400
      });
    }
    const body = parsedBody.data;
    assertAllowed({
      value: body.redirectUri,
      envName: "EXTENSION_REDIRECT_URIS"
    });
    const tokens = await ctx.runMutation(
      internal.oauth.consumeCredentialExchange,
      {
        codeHash: await sha256(body.code),
        redirectUri: body.redirectUri
      }
    );
    return jsonResponse({
      body: tokens
    });
  } catch (error) {
    return jsonResponse({ body: { error: errorMessage(error) }, status: 400 });
  }
});
