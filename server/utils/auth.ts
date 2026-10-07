import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { db, schema } from "@nuxthub/db";

/**
 * Parse a URL and return only the origin (protocol + host + port).
 * Handles URLs with or without trailing slashes, with or without https:// prefix.
 * Returns null if the URL cannot be parsed.
 */
function normalizeOrigin(url: string): string | null {
  try {
    // Normalize: prepend https:// if no protocol specified
    const normalized = url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Build the list of trusted origins for Better Auth.
 *
 * Strategy:
 * - BETTER_AUTH_URL is the canonical public application URL — always trusted when set
 * - VERCEL_URL is injected by Vercel per deployment — always trusted when available
 * - No wildcards, no dynamic request-origin inspection, no string concatenation
 */
function getTrustedOrigins(): string[] {
  const origins = new Set<string>();

  const configuredUrl = process.env.BETTER_AUTH_URL?.trim();
  if (configuredUrl) {
    const origin = normalizeOrigin(configuredUrl);
    if (origin) origins.add(origin);
  }

  const deploymentUrl = process.env.VERCEL_URL?.trim();
  if (deploymentUrl) {
    const origin = normalizeOrigin(deploymentUrl);
    if (origin) origins.add(origin);
  }

  return origins.size > 0 ? Array.from(origins) : undefined;
}

// BETTER_AUTH_URL is the canonical public URL (set in Vercel project settings).
// baseURL must be a full URL, not an origin — used for OAuth callbacks and session cookies.
const configuredUrl = process.env.BETTER_AUTH_URL?.trim();
const deploymentUrl = process.env.VERCEL_URL?.trim();

// baseURL: prefer the configured canonical URL; fall back to the deployment URL.
// If neither is set, baseURL will be undefined (dev mode — Better Auth handles it gracefully).
const baseURL = configuredUrl
  ? normalizeOrigin(configuredUrl) || deploymentUrl?.replace(/\/$/, "")
  : deploymentUrl?.replace(/\/$/, "");

export const auth = betterAuth({
  baseURL: baseURL || undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  // trustedOrigins is an array of origin strings (scheme://host:port), not full URLs
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
