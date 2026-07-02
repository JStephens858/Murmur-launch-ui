import type { NextRequest } from "next/server";

import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
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
