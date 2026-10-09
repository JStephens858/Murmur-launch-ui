/**
 * Account creation for the web, server side only.
 *
 * The API owns account creation: one mutation makes the Auth0
 * email/password user and the Murmur `users` row together, so partial
 * failures are handled in one place for every client. It does NOT hand back
 * tokens. Auth0 refresh tokens belong to the client that requested them, and
 * the web keeps sessions alive by refreshing with its own client id and
 * secret; tokens minted for another client would stop working at the first
 * expiry. So after the mutation succeeds, the web signs in exactly as /login
 * does (lib/auth0-password-login.ts) and writes its own session.
 *
 * The contract this expects from the API (a public, unauthenticated
 * mutation; the usual Murmur envelope):
 *
 *   mutation createUserWithPassword($email: String!, $password: String!) {
 *     createUserWithPassword(email: $email, password: $password) {
 *       success
 *       errorMsg
 *       errorCode
 *     }
 *   }
 *
 *   errorCode: 409 email already has an account
 *              422 password rejected by the Auth0 password policy
 *                  (errorMsg may carry Auth0's wording)
 *              400 email not valid
 *              429 too many attempts from this client
 *              anything else: unavailable
 *
 * The person's address goes along as `X-Murmur-Client-IP` so the API can
 * rate-limit per person (every call comes from this server's address, which
 * is also all Auth0 would see). The password must stay out of the API's
 * request logging.
 */

import { trustedClientIp } from "./client-ip";

/**
 * Web sign-up is built but not live: off unless ENABLE_WEB_SIGNUP=true.
 * Off, /signup is a 404, the Server Action refuses, and /login points to
 * the app instead of linking here. Read at request time, server side only.
 */
export function webSignupEnabled(): boolean {
  return process.env.ENABLE_WEB_SIGNUP === "true";
}
import { fetchMurmurAPI } from "./murmur-api";

const CREATE_USER_WITH_PASSWORD = /* GraphQL */ `
  mutation createUserWithPassword($email: String!, $password: String!) {
    createUserWithPassword(email: $email, password: $password) {
      success
      errorMsg
      errorCode
    }
  }
`;

export type SignupErrorCode =
  | "email_in_use"
  | "weak_password"
  | "invalid_email"
  | "too_many_attempts"
  | "unavailable";

export class SignupError extends Error {
  constructor(
    public readonly code: SignupErrorCode,
    /** The API's own message, for logs and for a password-policy hint. */
    public readonly apiMessage: string | null = null,
  ) {
    super(apiMessage ?? code);
    this.name = "SignupError";
  }
}

const CODES: Record<number, SignupErrorCode> = {
  409: "email_in_use",
  422: "weak_password",
  400: "invalid_email",
  429: "too_many_attempts",
};

/** The app's rules (SignupModel2): at least 8 characters, a digit, a lower- and an uppercase letter. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (
    !/\d/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password)
  )
    return "Include an uppercase letter, a lowercase letter and a number.";
  return null;
}

/** The app's email pattern (SignupModel2.emailRegex). */
export function emailLooksValid(email: string): boolean {
  return /^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,64}$/.test(email);
}

/** Creates the account through the API. Throws SignupError on any failure. */
export async function createAccountWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const clientIp = await trustedClientIp();
  let res: {
    createUserWithPassword: {
      success: boolean;
      errorMsg: string | null;
      errorCode: number | null;
    } | null;
  };
  try {
    res = await fetchMurmurAPI(CREATE_USER_WITH_PASSWORD, {
      variables: { email, password },
      headers: clientIp ? { "X-Murmur-Client-IP": clientIp } : undefined,
    });
  } catch (error) {
    throw new SignupError(
      "unavailable",
      error instanceof Error ? error.message : String(error),
    );
  }
  const out = res.createUserWithPassword;
  if (!out) throw new SignupError("unavailable", "empty response");
  if (!out.success) {
    throw new SignupError(
      (out.errorCode != null && CODES[out.errorCode]) || "unavailable",
      out.errorMsg,
    );
  }
}
