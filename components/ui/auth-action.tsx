"use client";

import { useUser } from "@auth0/nextjs-auth0";

/**
 * Session-aware auth link: "Physician Login" signed out, "My Account"
 * signed in. Client-side (via /auth/profile) so static pages stay static.
 *
 * Sign-in goes to /login, our own form, not the Auth0-hosted page — accounts
 * are created in the iOS app and must not be creatable from the web. See
 * lib/auth0-password-login.ts.
 */
export default function AuthAction({ className }: { className?: string }) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return null;
  }

  return user ? (
    <a href="/account" className={className}>
      My Account
    </a>
  ) : (
    <a href="/login?returnTo=/account" className={className}>
      Physician Login
    </a>
  );
}
