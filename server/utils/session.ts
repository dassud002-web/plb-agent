import type { H3Event } from "h3";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "~~/auth";
import { getNodeRequest } from "~~/server/utils/h3-node";

export async function requireSessionUserId(event: H3Event): Promise<string> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(getNodeRequest(event).headers),
  });

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  return session.user.id;
}

/**
 * Authenticates internal service-to-service calls.
 * Requires Authorization: Bearer <INTERNAL_API_SECRET>
 */
export async function requireInternalApiSecret(event: H3Event): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: "INTERNAL_API_SECRET is not configured",
    });
  }

  const authHeader = getHeader(event, "authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (authHeader !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid internal API secret",
    });
  }
}
