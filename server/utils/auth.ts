import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { db, schema } from "@nuxthub/db";

// BETTER_AUTH_URL is the canonical env var (set in Vercel project settings).
// If not set, fall back to VERCEL_URL which Vercel injects automatically per deployment.
const betterAuthUrl =
  process.env.BETTER_AUTH_URL?.trim() ||
  process.env.VERCEL_URL?.replace(/\/$/, "") ||  // e.g. https://plb-agent-xxx.vercel.app
  undefined;

export const auth = betterAuth({
  baseURL: betterAuthUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  // Trust the configured production origin. If unset, trust the Vercel deployment URL.
  trustedOrigins: betterAuthUrl ? [betterAuthUrl] : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
