import type { Metadata } from "next";

import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Items from "@/components/sections/items/default";
import Navbar from "@/components/sections/navbar/default";

export const metadata: Metadata = {
  title: "Physicians",
  description:
    "Why physicians join MurmurMD: case discussions, outcome reviews, recommendations, and polls in a verified physicians-only community.",
};

export default function PhysiciansPage() {
  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="Built for physicians, by physicians"
        description="Share cases, compare outcomes, and see where your peers actually stand — in a verified community of physicians, with interventional cardiology at its core."
        badge={false}
        buttons={[
          { href: "/get-the-app", text: "Get the App", variant: "default" },
          { href: "/videos", text: "Browse Videos", variant: "glow" },
        ]}
        mockup={false}
      />
      <Items title="What happens on MurmurMD" />
      <CTA title="Join your colleagues" />
      <Footer />
    </main>
  );
}
