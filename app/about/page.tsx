import type { Metadata } from "next";

import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Navbar from "@/components/sections/navbar/default";

export const metadata: Metadata = {
  title: "About",
  description:
    "MurmurMD is the professional community where physicians talk medicine — cases, outcomes, recommendations, and polls.",
};

export default function AboutPage() {
  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="About MurmurMD"
        description="We built MurmurMD because the best conversations in medicine happen between colleagues — and they deserve a better place than hallway run-ins and group texts. MurmurMD gives verified physicians a professional home to share cases, review outcomes, and learn from each other."
        badge={false}
        buttons={false}
        mockup={false}
      />
      <CTA title="Talk medicine with us" />
      <Footer />
    </main>
  );
}
