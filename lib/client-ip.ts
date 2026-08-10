/**
 * Client IP access for the ported legacy endpoints.
 *
 * Two different values, deliberately:
 *
 *  - `rawForwardedFor()` is what goes to createIPInviteLinkage. Legacy passed
 *    `req.header('X-Forwarded-For')` through verbatim, so the invite→IP table
 *    is full of whatever that header contained (often a comma-separated chain).
 *    Normalising it now would change the shape of the data mid-stream and break
 *    whatever reads it, so this stays raw.
 *
 *  - `trustedClientIp()` is a best-effort single address for logging and rate
 *    limiting only. X-Forwarded-For is client-settable, so the trustworthy
 *    entry is the Nth from the right, where N is the number of proxies you
 *    actually control (MURMUR_XFF_TRUSTED_HOPS).
 *
 * Note for cutover: verify nginx appends to X-Forwarded-For the same way the
 * old ELB did. An extra hop changes every string stored by the linkage call.
 */

import { headers } from "next/headers";

/** Raw X-Forwarded-For, exactly as legacy read it. For the linkage mutation. */
export async function rawForwardedFor(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for");
}

function pickTrusted(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const chain = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return null;
  const hops = Number(process.env.MURMUR_XFF_TRUSTED_HOPS) || 0;
  // hops=0 -> the right-most entry, i.e. whatever spoke to our own proxy.
  const index = chain.length - 1 - hops;
  return chain[Math.max(0, Math.min(index, chain.length - 1))] ?? null;
}

/** Single address for logging and rate limiting. Never for stored data. */
export async function trustedClientIp(): Promise<string | null> {
  return pickTrusted(await rawForwardedFor());
}

/** Route-handler variants, where the request object is in hand. */
export function rawForwardedForFrom(request: Request): string | null {
  return request.headers.get("x-forwarded-for");
}

export function trustedClientIpFrom(request: Request): string | null {
  return pickTrusted(rawForwardedForFrom(request));
}
