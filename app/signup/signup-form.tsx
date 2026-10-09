"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signUp, type SignUpState } from "./actions";

const INITIAL: SignUpState = { error: null };

/** Email, password and confirmation; the rules are checked again on the server. */
export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signUp, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email}
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
          autoComplete="new-password"
          minLength={8}
          aria-describedby="password-rules"
          required
          disabled={isPending}
        />
        <p id="password-rules" className="text-muted-foreground text-xs">
          At least 8 characters, with an uppercase letter, a lowercase letter
          and a number.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
        />
      </div>

      {state.error && (
        <p
          role="alert"
          aria-live="polite"
          className="text-destructive-foreground text-sm"
        >
          {state.error}{" "}
          {state.createdButNotSignedIn && (
            <a href="/login" className="text-foreground underline">
              Sign in
            </a>
          )}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
