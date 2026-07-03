import type { Metadata } from "next";

import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Navbar from "@/components/sections/navbar/default";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Partner with MurmurMD to support the physician community and better understand physicians' concerns, preferences, and unmet needs.",
};

export default function PartnersPage() {
  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="Working together for the community"
        description="We partner with medical device and related companies that want to help the physician community thrive. Partnerships center on supporting education and understanding physician sentiment — the concerns, preferences, and unmet needs that matter to practicing doctors."
        badge={false}
        appStoreBadge={false}
        buttons={[
          {
            href: `${siteConfig.links.email}?subject=Partner%20inquiry`,
            text: "Start a Conversation",
            variant: "glow",
          },
        ]}
        mockup={false}
      />
      <CTA
        title="Let's work together"
        appStoreBadge={false}
        buttons={[
          {
            href: `${siteConfig.links.email}?subject=Partner%20inquiry`,
            text: "Contact Us",
            variant: "glow",
          },
        ]}
      />
      <Footer />
    </main>
  );
}
