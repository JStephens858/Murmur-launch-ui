import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";

export const metadata: Metadata = {
  title: "Account",
};

/**
 * Minimal signed-in landing page proving the Auth0 session round-trip.
 * Grows into the physician web experience (browse posts, etc.) later.
 */
export default async function AccountPage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/account");
  }

  const { user } = session;

  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col gap-6 px-4 py-24">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Welcome{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          You&apos;re signed in{user.email ? ` as ${user.email}` : ""}. The
          physician web experience — browsing posts and more of what you can do
          in the app — is coming here.
        </p>
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
