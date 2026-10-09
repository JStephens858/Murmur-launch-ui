import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { auth0 } from "@/lib/auth0";
import { shareMetadata } from "@/lib/metadata";

import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create your MurmurMD account.",
  robots: { index: false, follow: false },
  ...shareMetadata("/signup"),
};

/**
 * Account creation on the web: email and password here, the account made by
 * the API, then onboarding (where physician verification happens) as in
 * the app. See lib/murmur-signup.ts.
 */
export default async function SignupPage() {
  // Already signed in: nothing to create.
  if (await auth0.getSession()) redirect("/account");

  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col items-center px-4 py-24">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Create your account</h1>
            <p className="text-muted-foreground text-sm">
              MurmurMD is for physicians. After you sign up we&apos;ll set up
              your profile and verify that you&apos;re a practicing physician.
            </p>
          </div>

          <SignupForm />

          <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-foreground underline">
              Sign in
            </a>
            .
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
