"use client";

import { useUser } from "@auth0/nextjs-auth0";

/**
 * Session-aware auth link: "Physician Login" signed out, "My Account"
 * signed in. Client-side (via /auth/profile) so static pages stay static.
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
    <a href="/auth/login?returnTo=/account" className={className}>
      Physician Login
    </a>
  );
}
