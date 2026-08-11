/**
 * Turns a token set from lib/auth0-password-login.ts into the session the
 * @auth0/nextjs-auth0 SDK itself reads.
 *
 * The important decision here is what "set the tokens as cookies" means. Tokens
 * are NOT written as cookies of their own: doing that would put a bearer token
 * where any XSS could read it, and would leave the rest of the app blind to it
 * — useUser(), auth0.getSession(), auth0.getAccessToken() and the token refresh
 * in proxy.ts all read one specific encrypted cookie. So this writes exactly
 * that cookie, in the SDK's own format, via the SDK's own session store. Custom
 * sign-in becomes just another way to populate it; every consumer downstream is
 * unchanged, and /auth/logout still clears it.
 *
 * The shape mirrors AuthClient#createSessionFromPasswordlessVerify in the SDK
 * (dist/server/auth-client.js) — the closest first-party equivalent, since
 * passwordless OTP is also "custom UI drives the token endpoint, then a session
 * is created". Keep the two in step when upgrading the SDK.
 */

import type { AbstractSessionStore } from "@auth0/nextjs-auth0/server";
import { filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import type { SessionData, User } from "@auth0/nextjs-auth0/types";
import { cookies } from "next/headers";

import { auth0 } from "./auth0";
import type { PasswordLoginTokens } from "./auth0-password-login";

/**
 * `sessionStore` is TypeScript-private on Auth0Client, not runtime-private, and
 * the SDK exposes no supported way to create a session from tokens you already
 * hold (updateSession() throws unless one exists; the testing helper
 * generateSessionCookie() hardcodes a 1-hour maxAge and cannot chunk a cookie
 * over 4KB, which an audience-scoped access token plus an ID token will exceed).
 *
 * So: reach in, but fail loudly rather than silently writing no cookie if a
 * future SDK version renames or restructures it.
 */
function getSessionStore(): AbstractSessionStore {
  const store = (auth0 as unknown as { sessionStore?: AbstractSessionStore })
    .sessionStore;
  if (!store || typeof store.set !== "function") {
    throw new Error(
      "Auth0Client.sessionStore is missing or has changed shape — the custom " +
        "sign-in in lib/auth0-session.ts needs updating for this SDK version.",
    );
  }
  return store;
}

/** Decodes a JWT payload without verifying it. See createSession for why. */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1];
  if (!payload) {
    throw new Error("id_token is not a JWT");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/**
 * The ID token came back on our own TLS connection to Auth0's token endpoint,
 * in response to a request carrying the client secret — it was not routed
 * through the browser, so there is no attacker-in-the-middle to forge it and
 * signature verification would only re-prove the transport. (This is the same
 * reasoning the SDK applies in createSessionFromPasswordlessVerify, which also
 * decodes without verifying.) The claims below are still checked, because a
 * mismatch means we are pointed at the wrong tenant or application.
 */
function claimsFromIdToken(idToken: string): User {
  const claims = decodeJwtPayload(idToken);

  const expectedIssuer = `https://${process.env.AUTH0_DOMAIN}/`;
  if (claims.iss !== expectedIssuer) {
    throw new Error(
      `id_token issuer ${String(claims.iss)} is not ${expectedIssuer}`,
    );
  }

  const audience = claims.aud;
  const audiences = Array.isArray(audience) ? audience : [audience];
  if (!audiences.includes(process.env.AUTH0_CLIENT_ID)) {
    throw new Error("id_token audience does not include AUTH0_CLIENT_ID");
  }

  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("id_token has no sub claim");
  }

  return claims as User;
}

/**
 * Writes the session cookie for the given tokens. Must be called from a Server
 * Action or Route Handler — anywhere else, cookies() is read-only.
 */
export async function createSessionFromTokens(
  tokens: PasswordLoginTokens,
): Promise<void> {
  if (!tokens.id_token) {
    throw new Error(
      "No id_token in the token response — check that AUTH0_SCOPE includes 'openid'.",
    );
  }

  const claims = claimsFromIdToken(tokens.id_token);
  const now = Math.floor(Date.now() / 1000);

  const session: SessionData = {
    // Same trim the SDK applies when no beforeSessionSaved hook is configured:
    // keep the standard profile claims out of the cookie's way.
    user: filterDefaultIdTokenClaims(claims),
    tokenSet: {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiresAt: now + Number(tokens.expires_in),
    },
    internal: {
      // ROPG ID tokens carry no `sid`. A local id keeps the session
      // self-consistent; it will not match a back-channel logout token from
      // Auth0, which is a known limit of signing in this way.
      sid: typeof claims.sid === "string" ? claims.sid : crypto.randomUUID(),
      createdAt: now,
    },
  };

  /*
   * The store wants a request cookie jar and a response cookie jar, and it
   * writes to both: the response one gets the cookie with its attributes, then
   * the request one gets the same cookie with no attributes, so that middleware
   * can read back what it just wrote (setChunkedCookie in the SDK's cookies.ts).
   *
   * In a Server Action next/headers' cookies() is a single jar, so handing it
   * over as both makes that second attribute-less write land on top of the
   * first: the session cookie goes to the browser with a Path and nothing else
   * — no HttpOnly, no SameSite, no Secure, no Max-Age. Confirmed by reading the
   * Set-Cookie header, not assumed.
   *
   * So only the response jar is real. The request jar is a read-only view of
   * the incoming cookies, which is all the store needs one for here: finding
   * leftover chunks from a previous, larger session to clear. Its writes are
   * dropped, and nothing in this path reads them back.
   */
  const cookieStore = await cookies();
  type SetArgs = Parameters<AbstractSessionStore["set"]>;
  const requestCookieView = {
    get: (name: string) => cookieStore.get(name),
    getAll: () => cookieStore.getAll(),
    has: (name: string) => cookieStore.has(name),
    set: () => {},
    delete: () => {},
  };

  await getSessionStore().set(
    requestCookieView as unknown as SetArgs[0],
    cookieStore as unknown as SetArgs[1],
    session,
    true,
  );
}
