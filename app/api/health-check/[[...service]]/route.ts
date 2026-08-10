import { NextResponse } from "next/server";

import { healthCheck } from "@/lib/murmur-legacy";

/**
 * Dependency health probe, reached by rewrite from /health-check and
 * /health-check-<service> (see proxy.ts, which derives the service using
 * legacy's split('-')[2] semantics).
 *
 * The service arrives as a path segment rather than a query parameter because
 * query strings do not survive NextResponse.rewrite — every probe silently
 * reported on the default service when this took ?service. An optional catch-all
 * so the bare /api/health-check still resolves.
 *
 * This reports on the Murmur API, not on this web server. Point the load
 * balancer's target-group check at /web-health.html instead: if it watched this
 * endpoint, an API outage would pull the web servers and take the marketing site
 * down with it.
 *
 * Legacy answered with sendStatus(200) / sendStatus(500), so the body was the
 * status text. Kept, in case anything monitoring it matches on the body.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service?: string[] }> },
) {
  const { service: segments } = await params;
  const service = segments?.[0] || "api1";

  try {
    const ok = await healthCheck(service, AbortSignal.timeout(5000));
    if (ok) {
      console.info(`API server Health Check OK (${service})`);
      return new NextResponse("OK", { status: 200 });
    }
    console.error(`API server Health Check FAILED (${service})`);
    return new NextResponse("Internal Server Error", { status: 500 });
  } catch (error) {
    console.error(
      `API server Health Check FAILED (${service}):`,
      error instanceof Error ? error.message : error,
    );
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
