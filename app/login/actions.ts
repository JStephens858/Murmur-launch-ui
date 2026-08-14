"use server";

import { redirect } from "next/navigation";

import {
  loginWithPassword,
  PasswordLoginError,
  type PasswordLoginErrorCode,
} from "@/lib/auth0-password-login";
import { createSessionFromTokens } from "@/lib/auth0-session";

export interface SignInState {
  error: string | null;
}

/**
 * What the user is told. "invalid_credentials" must stay vague — saying whether
 * the address exists would turn this form into a directory of MurmurMD
 * physicians for anyone who wants to enumerate it.
 */
const USER_MESSAGE: Record<PasswordLoginErrorCode, string> = {
  invalid_credentials: "Incorrect email or password.",
  mfa_required:
    "This account uses two-factor authentication, which isn't supported on the web yet. Please sign in from the MurmurMD app.",
  too_many_attempts:
    "Too many sign-in attempts. Wait a few minutes and try again, or reset your password.",
  blocked: "This account can't sign in. Contact contact@murmurmd.com for help.",
  configuration: "Sign-in is temporarily unavailable. Please try again later.",
  unavailable: "Sign-in is temporarily unavailable. Please try again later.",
};

/**
 * Only same-site paths. Without this check, /login?returnTo=https://evil.example
 * would hand a freshly signed-in physician to someone else's page.
 */
function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/account";
  // "//host" and "/\host" are both protocol-relative once a browser sees them.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/account";
  }
  return value;
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  try {
    const tokens = await loginWithPassword(email, password);
    await createSessionFromTokens(tokens);
  } catch (error) {
    const code =
      error instanceof PasswordLoginError ? error.code : "unavailable";

    /*
     * The user-facing copy is deliberately uninformative, so the real reason
     * has to be recoverable from the logs — a misconfigured grant type and a
     * physician mistyping a password look identical from the browser. The
     * email is not logged: failed attempts are exactly where a typo'd password
     * ends up next to an address.
     */
    console.error(
      JSON.stringify({
        event: "password-login-failed",
        code,
        auth0Error:
          error instanceof PasswordLoginError ? error.auth0Error : undefined,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );

    return { error: USER_MESSAGE[code] };
  }

  // Outside the catch: redirect() signals by throwing, and swallowing that
  // would leave the user on the form despite a valid session.
  redirect(returnTo);
}
