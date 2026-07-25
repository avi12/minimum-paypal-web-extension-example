export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
export const CREDENTIAL_EXCHANGE_TTL_MS = 60 * 1000;

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
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
