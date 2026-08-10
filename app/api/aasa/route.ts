import { NextResponse } from "next/server";

import { appleAppSiteAssociation } from "@/lib/aasa";

/**
 * Apple App Site Association, reached by rewrite from both
 * /.well-known/apple-app-site-association and /apple-app-site-association
 * (see proxy.ts).
 *
 * A route handler rather than a file in public/ because the URL is
 * extensionless — static serving would guess application/octet-stream, and
 * Apple requires application/json. The Content-Type is set explicitly rather
 * than left to NextResponse.json so it can't drift.
 *
 * Apple's CDN caches this, so a bad response can break universal links in the
 * shipped app for around a day. Verify before any traffic moves.
 */
export const dynamic = "force-static";

export async function GET() {
  return new NextResponse(JSON.stringify(appleAppSiteAssociation), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
