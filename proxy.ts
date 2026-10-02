import { type NextRequest, NextResponse } from "next/server";

import { auth0 } from "./lib/auth0";
import { parseHealthCheckService } from "./lib/legacy-urls";

/**
 * Legacy endpoints ported from Murmur-express that take a state-changing action.
 * Matched by prefix. See lib/legacy-guard.ts for why they need protecting.
 */
const LEGACY_ACTION_PREFIXES = [
  "/emailVerification",
  "/acceptReengagementPosts",
  "/doNotPromote",
  "/invite/",
  "/invite2/",
  "/invite3/",
  "/invite4/",
  "/invite-qr/",
  "/appstore/",
];

function isLegacyActionPath(pathname: string): boolean {
  return LEGACY_ACTION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * The physician portal, app/(portal). Top-level paths rather than a /portal
 * prefix, following X's URL scheme (/feed, /explore, ...). The public video library
 * moved to /videolibrary so the portal could own /videos. Each entry is a
 * route segment, so /feedback would not match.
 */
const PORTAL_SEGMENTS = [
  "/feed",
  "/videos",
  "/explore",
  "/notifications",
  "/groups",
  "/messages",
  "/profile",
  "/more",
  "/compose",
  "/postDetail",
];

function isPortalPath(pathname: string): boolean {
  return PORTAL_SEGMENTS.some(
    (segment) => pathname === segment || pathname.startsWith(`${segment}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Apple App Site Association. Rewritten to a route handler rather than served
   * from public/ for two reasons: the filename is extensionless, so static
   * serving would guess application/octet-stream where Apple requires JSON; and
   * Apple will not follow a redirect, so this has to be a rewrite. Handled here
   * instead of via next.config rewrites so it doesn't depend on the relative
   * ordering of middleware and beforeFiles.
   */
  if (
    pathname === "/.well-known/apple-app-site-association" ||
    pathname === "/apple-app-site-association"
  ) {
    return NextResponse.rewrite(new URL("/api/aasa", request.url));
  }

  // Load-balancer liveness probe — a static file, no session work. Kept separate
  // from /health-check* so that pure web liveness never depends on the API.
  if (pathname === "/web-health.html") {
    return NextResponse.next();
  }

  /*
   * /health-check and /health-check-<service> are a single path segment, so the
   * App Router can't match the suffix as a param. Plain string logic here is
   * deterministic, and it keeps Auth0 session work off a probe that fires every
   * few seconds. The loose startsWith matches legacy, including the quirk that
   * /health-checkfoo resolves to the default service.
   */
  if (pathname.startsWith("/health-check")) {
    // The service goes in the path, not a query parameter: query strings do not
    // survive NextResponse.rewrite, so ?service silently arrived empty and every
    // probe reported on the default service.
    const service = parseHealthCheckService(pathname);
    return NextResponse.rewrite(
      new URL(`/api/health-check/${encodeURIComponent(service)}`, request.url),
    );
  }

  /*
   * Legal pages keep the extensionless URLs the App Store listing and the iOS
   * app link to: /info/privacy_policy -> public/info/privacy_policy.html. The
   * dot check is what lets the stylesheets those pages reference through
   * untouched, mirroring legacy's `.css` passthrough.
   */
  if (pathname.startsWith("/info/")) {
    const slug = pathname.slice("/info/".length);
    if (slug.length > 0 && !slug.includes(".")) {
      return NextResponse.rewrite(new URL(`${pathname}.html`, request.url));
    }
    return NextResponse.next();
  }

  /*
   * The ported legacy endpoints must never act on a non-GET request. Two things
   * make this the only workable place for the check: Next implements HEAD by
   * calling the GET handler verbatim
   * (next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js),
   * and a Server Component can't see the request method at all. Returning 200
   * keeps link-checkers and monitors happy without touching the API.
   */
  if (request.method !== "GET" && isLegacyActionPath(pathname)) {
    return new NextResponse(null, { status: 200 });
  }

  const authResponse = await auth0.middleware(request);

  /*
   * Optimistic sign-in check for the portal: reads the session cookie only, no
   * API call, and bounces to /login with the path to come back to. Pages that
   * fetch data still verify the session themselves; this just keeps the shell
   * from ever rendering signed out.
   */
  if (isPortalPath(pathname) && !(await auth0.getSession(request))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Refresh the access token here for pages that call the Murmur API:
  // the proxy can persist an updated token set to cookies, which Server
  // Components cannot.
  if (pathname.startsWith("/account") || isPortalPath(pathname)) {
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
     * and sessions stay rolling on page navigation. The legacy rewrites above
     * need /.well-known/*, /info/* and /health-check* to reach this proxy, so
     * they must not be excluded here.
     */
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|mp4|m3u8)).*)",
  ],
};
