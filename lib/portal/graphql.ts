import { getAccessToken } from "@auth0/nextjs-auth0/client";

/**
 * Browser-side client for the Murmur GraphQL API.
 *
 * Signed-in pages talk to the API directly from the browser with the
 * physician's Auth0 access token, the way the iOS app does (decision of
 * 2026-07-03), rather than through a Next route. The token comes from the
 * SDK's /auth/access-token endpoint, which reads the session cookie and
 * refreshes if needed; it is cached here until shortly before it expires so
 * a feed scroll doesn't hit that endpoint once per page.
 *
 * Only client components import this. The server-side client for public
 * pages is lib/murmur-api.ts.
 */

const ENDPOINT = process.env.NEXT_PUBLIC_MURMUR_API_SERVER;

/** Thrown when there is no usable session; callers send the user to /login. */
export class PortalAuthError extends Error {
  constructor(message = "Your session has expired.") {
    super(message);
    this.name = "PortalAuthError";
  }
}

export class PortalApiError extends Error {
  constructor(
    message: string,
    public readonly code: number | null = null,
  ) {
    super(message);
    this.name = "PortalApiError";
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Seconds-since-epoch `exp` from a JWT payload, or null if it isn't one. */
function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }
  let token: string;
  try {
    token = await getAccessToken();
  } catch (error) {
    cachedToken = null;
    throw new PortalAuthError(
      error instanceof Error ? error.message : "Your session has expired.",
    );
  }
  const exp = jwtExpiry(token);
  cachedToken = {
    token,
    // Opaque tokens carry no expiry; re-ask every five minutes.
    expiresAt: exp ? exp * 1000 : Date.now() + 5 * 60_000,
  };
  return token;
}

export async function portalQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!ENDPOINT) {
    throw new PortalApiError("NEXT_PUBLIC_MURMUR_API_SERVER is not set");
  }
  const token = await accessToken();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) {
    cachedToken = null;
    throw new PortalAuthError();
  }
  if (!res.ok) {
    throw new PortalApiError(`Murmur API responded ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new PortalApiError(json.errors[0].message);
  }
  return json.data as T;
}

/** Drops a cached token, e.g. after the API rejects it. */
export function forgetAccessToken() {
  cachedToken = null;
}
