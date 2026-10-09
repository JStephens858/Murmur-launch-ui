import { type NextRequest, NextResponse } from "next/server";

import { deleteSession } from "@/lib/auth0-session";

/**
 * Signs the physician out and sends them to the sign-in page. Replaces the
 * SDK's /auth/logout, whose Auth0 round trip ends on an error page unless
 * the return URL is on the tenant's allow list; see deleteSession for why
 * clearing the cookie is enough. POST from the profile's Log out button;
 * GET too, so the URL works when visited.
 */
async function logout(request: NextRequest) {
  // 303 so a POST is followed by a GET of the sign-in page.
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  await deleteSession(request.cookies, response.cookies);
  return response;
}

export const GET = logout;
export const POST = logout;
