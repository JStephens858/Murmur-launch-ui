"use server";

import { redirect } from "next/navigation";

import {
  loginWithPassword,
  PasswordLoginError,
} from "@/lib/auth0-password-login";
import { createSessionFromTokens } from "@/lib/auth0-session";
import {
  createAccountWithPassword,
  emailLooksValid,
  passwordProblem,
  SignupError,
  type SignupErrorCode,
  webSignupEnabled,
} from "@/lib/murmur-signup";

export interface SignUpState {
  error: string | null;
  /** The account exists but signing in afterwards failed; offer /login. */
  createdButNotSignedIn?: boolean;
  /** Echoed back so a failed attempt doesn't empty the email field. */
  email?: string;
}

/**
 * What the person is told. "email_in_use" is deliberately soft: it points at
 * sign-in and password reset rather than stating flatly that the address is
 * registered, which would make this form a directory of MurmurMD members.
 */
const USER_MESSAGE: Record<SignupErrorCode, string> = {
  email_in_use:
    "We couldn't create an account with that email. If you already have one, sign in or reset your password.",
  weak_password:
    "That password doesn't meet the requirements. Use at least 8 characters with an uppercase letter, a lowercase letter and a number.",
  invalid_email: "Enter a valid email address.",
  too_many_attempts: "Too many attempts. Wait a few minutes and try again.",
  unavailable:
    "Account creation is temporarily unavailable. Please try again later.",
};

/** Where a new account goes next. Onboarding will take this over. */
const AFTER_SIGNUP = "/account";

/**
 * Creates the account through the API (lib/murmur-signup.ts), then signs in
 * the same way /login does and writes the session. A Server Action for the
 * same reasons as sign-in: Next checks Origin against Host on every action,
 * and the password never appears in a URL or client state.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  // Actions can be called directly even with the page hidden, so the switch
  // is checked here too.
  if (!webSignupEnabled()) {
    return { error: "Account creation isn't available on the web yet." };
  }
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and a password.", email };
  }
  if (!emailLooksValid(email)) {
    return { error: USER_MESSAGE.invalid_email, email };
  }
  const weak = passwordProblem(password);
  if (weak) return { error: weak, email };
  if (password !== confirm) {
    return { error: "The passwords don't match.", email };
  }

  try {
    await createAccountWithPassword(email, password);
  } catch (error) {
    const code = error instanceof SignupError ? error.code : "unavailable";
    // Neither the email nor the password is logged.
    console.error(
      JSON.stringify({
        event: "signup-failed",
        code,
        apiMessage: error instanceof SignupError ? error.apiMessage : undefined,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return { error: USER_MESSAGE[code], email };
  }

  try {
    const tokens = await loginWithPassword(email, password);
    await createSessionFromTokens(tokens);
  } catch (error) {
    // The account exists; only the automatic sign-in failed. Say so plainly
    // rather than inviting a second sign-up attempt.
    console.error(
      JSON.stringify({
        event: "signup-signin-failed",
        code: error instanceof PasswordLoginError ? error.code : "unavailable",
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return {
      error: "Your account was created, but we couldn't sign you in.",
      createdButNotSignedIn: true,
      email,
    };
  }

  // Outside the try: redirect() signals by throwing.
  redirect(AFTER_SIGNUP);
}
