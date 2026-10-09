import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { auth0 } from "@/lib/auth0";
import { shareMetadata } from "@/lib/metadata";
import { webSignupEnabled } from "@/lib/murmur-signup";

import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Physician Sign In",
  description: "Sign in to MurmurMD.",
  // A sign-in form has nothing to index, and keeping it out of results keeps
  // it off the list of pages worth throwing credential stuffing at.
  robots: { index: false, follow: false },
  ...shareMetadata("/login"),
};

/**
 * Email/password sign-in for physicians who already have an account; new
 * accounts are made at /signup (lib/murmur-signup.ts), with physician
 * verification in onboarding as in the app. See lib/auth0-password-login.ts.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  // Already signed in — no reason to show the form.
  const session = await auth0.getSession();
  if (session) {
    redirect("/account");
  }

  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col items-center px-4 py-24">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Physician sign in</h1>
            <p className="text-muted-foreground text-sm">
              Use the email and password from your MurmurMD app account.
            </p>
          </div>

          <LoginForm returnTo={returnTo ?? "/account"} />

          {webSignupEnabled() ? (
            <p className="text-muted-foreground text-sm">
              New to MurmurMD?{" "}
              <a href="/signup" className="text-foreground underline">
                Create an account
              </a>
              .
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account? MurmurMD is physicians-only and
              accounts are created in the app, where we verify you&apos;re a
              practicing physician.{" "}
              <a href="/get-the-app" className="text-foreground underline">
                Get the app
              </a>
              .
            </p>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
