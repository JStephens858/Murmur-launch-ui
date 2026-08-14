"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signIn, type SignInState } from "./actions";

const INITIAL: SignInState = { error: null };

/**
 * Credentials go to a Server Action rather than a route handler on purpose:
 * Next verifies the Origin against the Host on every action request, so the
 * form gets CSRF protection without a hand-rolled token, and the password
 * never appears in a URL or in client-side JavaScript state.
 */
export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      {state.error && (
        // aria-live so a screen reader hears the failure: nothing else on the
        // page changes when the action comes back with an error.
        <p
          role="alert"
          aria-live="polite"
          className="text-destructive-foreground text-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
