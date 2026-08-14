/**
 * Direct email/password sign-in against Auth0's token endpoint, for the
 * physician web experience.
 *
 * Why this exists rather than Universal Login: accounts are created in the iOS
 * app, where the physician-verification step lives, and must not be creatable
 * from the web. Driving the token endpoint ourselves means the web never
 * renders a hosted page that could offer a signup path.
 *
 * Alternative considered: keep Universal Login and turn off "Sign Ups" on the
 * database connection (Auth0 → Authentication → Database → Disable Sign Ups),
 * which hides signup on the hosted page. That is the lower-risk option and
 * needs no code — see DECISIONS.md for why this route was taken instead, and
 * what it costs.
 *
 * The grant is Resource Owner Password (the `password-realm` variant, which
 * names the connection explicitly instead of relying on the tenant's Default
 * Directory setting). It requires, in the Auth0 dashboard:
 *
 *   - Application → Advanced Settings → Grant Types → Password enabled
 *   - The application is a Regular Web App, so it can hold AUTH0_CLIENT_SECRET
 *   - The API (AUTH0_AUDIENCE) has "Allow Offline Access" on, or no
 *     refresh_token comes back and the session cannot be extended
 *
 * This module never touches cookies — it returns tokens. lib/auth0-session.ts
 * turns them into a session.
 */

import { trustedClientIp } from "./client-ip";

const PASSWORD_REALM_GRANT = "http://auth0.com/oauth/grant-type/password-realm";

/** Bounds the wait: this call gates a form submission the user is watching. */
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

export type PasswordLoginErrorCode =
  /** Wrong email or password — deliberately not distinguished. */
  | "invalid_credentials"
  /** The account has MFA enrolled; this flow cannot complete it. */
  | "mfa_required"
  /** Auth0 attack protection has throttled this account or IP. */
  | "too_many_attempts"
  /** Blocked user, or an Action/Rule denied the login. */
  | "blocked"
  /** Our own misconfiguration (grant not enabled, bad secret, bad realm). */
  | "configuration"
  /** Auth0 unreachable, timed out, or answered something unparseable. */
  | "unavailable";

export class PasswordLoginError extends Error {
  readonly code: PasswordLoginErrorCode;
  /** Raw `error` from Auth0, for logs. Never shown to the user. */
  readonly auth0Error?: string;

  constructor(
    code: PasswordLoginErrorCode,
    message: string,
    auth0Error?: string,
  ) {
    super(message);
    this.name = "PasswordLoginError";
    this.code = code;
    this.auth0Error = auth0Error;
  }
}

export interface PasswordLoginTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in: number;
}

/**
 * Auth0's documented mapping. `invalid_grant` covers both "no such user" and
 * "wrong password" — collapsing them is what keeps this endpoint from being a
 * membership oracle, so the distinction must not be reintroduced.
 */
function toErrorCode(auth0Error: string | undefined): PasswordLoginErrorCode {
  switch (auth0Error) {
    case "invalid_grant":
      return "invalid_credentials";
    case "mfa_required":
      return "mfa_required";
    case "too_many_attempts":
      return "too_many_attempts";
    case "access_denied":
      return "blocked";
    case "unauthorized_client":
    case "unsupported_grant_type":
    case "invalid_client":
    case "invalid_request":
      return "configuration";
    default:
      return "unavailable";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new PasswordLoginError(
      "configuration",
      `${name} is not set`,
      "missing_env",
    );
  }
  return value;
}

/**
 * Exchanges an email and password for a token set.
 *
 * @throws {PasswordLoginError} for every failure, including transport errors,
 * so callers have one thing to catch and one place to map to user-facing copy.
 */
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<PasswordLoginTokens> {
  const domain = requiredEnv("AUTH0_DOMAIN");
  const clientId = requiredEnv("AUTH0_CLIENT_ID");
  const clientSecret = requiredEnv("AUTH0_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: PASSWORD_REALM_GRANT,
    realm:
      process.env.AUTH0_DB_CONNECTION ?? "Username-Password-Authentication",
    username: email,
    password,
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.AUTH0_SCOPE ?? "openid profile email offline_access",
  });
  const audience = process.env.AUTH0_AUDIENCE;
  if (audience) {
    body.set("audience", audience);
  }

  /*
   * Without this header Auth0 sees the web server's IP on every attempt, so
   * brute-force protection would either never trigger or lock out every
   * physician at once. It must carry a single address, not the raw
   * X-Forwarded-For chain.
   */
  const clientIp = await trustedClientIp();

  let response: Response;
  try {
    response = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(clientIp ? { "auth0-forwarded-for": clientIp } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new PasswordLoginError(
      "unavailable",
      error instanceof Error ? error.message : String(error),
      "fetch_failed",
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (payload ?? {}) as {
      error?: string;
      error_description?: string;
    };
    throw new PasswordLoginError(
      toErrorCode(detail.error),
      detail.error_description ?? `Auth0 responded ${response.status}`,
      detail.error,
    );
  }

  const tokens = payload as PasswordLoginTokens | null;
  if (!tokens?.access_token) {
    throw new PasswordLoginError(
      "unavailable",
      "Auth0 returned no access_token",
      "malformed_response",
    );
  }
  return tokens;
}
