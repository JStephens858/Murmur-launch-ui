import type { Metadata } from "next";

import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Navbar from "@/components/sections/navbar/default";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Commission video content and physician polls, and get market-research reports from the MurmurMD community.",
};

export default function PartnersPage() {
  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="Hear what physicians really think"
        description="Medical device and related companies work with MurmurMD to commission video content, run polls of our physician community, and receive market-research reports on what physicians are discussing — concerns, preferences, and unmet needs."
        badge={false}
        buttons={[
          {
            href: `${siteConfig.links.email}?subject=Partner%20inquiry`,
            text: "Start a Conversation",
            variant: "default",
          },
          { href: "/videos", text: "See Our Videos", variant: "glow" },
        ]}
        mockup={false}
      />
      <CTA title="Let's build something together" />
      <Footer />
    </main>
  );
}
