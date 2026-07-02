import type { NextRequest } from "next/server";

import { auth0 } from "./lib/auth0";

export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);

  // Refresh the access token here for pages that call the Murmur API:
  // the proxy can persist an updated token set to cookies, which Server
  // Components cannot.
  if (request.nextUrl.pathname.startsWith("/account")) {
    try {
      await auth0.getAccessToken(request, authResponse);
    } catch {
      // Not signed in or refresh failed — the page redirects / falls back.
    }
  }

  return authResponse;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, so the /auth/* routes mount
     * and sessions stay rolling on page navigation.
     */
    "/((?!_next/static|_next/image|favicon.svg|apple-touch-icon.png|.*\\.(?:png|jpg|jpeg|svg|gif|webp|mp4|m3u8)).*)",
  ],
};
