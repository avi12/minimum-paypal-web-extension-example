export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
export const CREDENTIAL_EXCHANGE_TTL_MS = 60 * 1000;

/**
 * A deployment that is missing or misconfigured, as opposed to a caller doing
 * something wrong. Naming the class is what lets the checkout boundary answer
 * "this is on us" instead of blaming the payment.
 */
export class ConfigurationError extends Error {}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(`Missing ${name}`);
  }
  return value;
}

function exactAllowlist(name: string) {
  return requireEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function assertAllowed({
  value,
  envName
}: {
  value: string;
  envName: string;
}) {
  if (!exactAllowlist(envName).includes(value)) {
    throw new Error(`Value is not allowlisted by ${envName}`);
  }
}
