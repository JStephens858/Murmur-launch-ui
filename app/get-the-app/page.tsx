import type { Metadata } from "next";

import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Navbar from "@/components/sections/navbar/default";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Get the App",
  description:
    "Download MurmurMD for iOS. Physicians only — we verify every member during signup.",
};

export default function GetTheAppPage() {
  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="Get MurmurMD for iOS"
        description="MurmurMD is available on the App Store. The community is physicians-only: we confirm you're a practicing physician during signup. Not a physician? Everything public — including the full video library — is right here on the web."
        badge={false}
        buttons={[
          {
            href: siteConfig.appStoreUrl,
            text: "Download on the App Store",
            variant: "default",
          },
          { href: "/videos", text: "Browse Videos Instead", variant: "glow" },
        ]}
        mockup={false}
      />
      <Footer />
    </main>
  );
}
