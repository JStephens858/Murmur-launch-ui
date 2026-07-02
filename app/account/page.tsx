import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";
import { getProfile, type ProfileUser } from "@/lib/murmur-api";

export const metadata: Metadata = {
  title: "Account",
};

/**
 * Minimal signed-in landing page proving the Auth0 session round-trip and
 * the authenticated GraphQL profile fetch. Grows into the physician web
 * experience (browse posts, etc.) later.
 */
export default async function AccountPage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/account");
  }

  let profile: ProfileUser | null = null;
  let profileError: string | null = null;
  try {
    const { token } = await auth0.getAccessToken();
    profile = await getProfile(token);
  } catch (error) {
    profileError = error instanceof Error ? error.message : String(error);
  }

  const fullName =
    profile && (profile.firstName || profile.lastName)
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
      : session.user.name;

  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col gap-6 px-4 py-24">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Welcome{fullName ? `, ${fullName}` : ""}
          </h1>
          {profile?.username && (
            <p className="text-muted-foreground">@{profile.username}</p>
          )}
        </div>
        <p className="text-muted-foreground max-w-2xl">
          You&apos;re signed in. The physician web experience — browsing posts
          and more of what you can do in the app — is coming here.
        </p>
        {profileError && (
          <p className="text-destructive max-w-2xl text-sm">
            Couldn&apos;t load your MurmurMD profile: {profileError}
          </p>
        )}
        <div className="flex gap-4">
          <Button asChild variant="outline">
            <a href="/auth/logout">Sign out</a>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
