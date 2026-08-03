import Audiences from "../components/sections/audiences/default";
import CTA from "../components/sections/cta/default";
import FAQ from "../components/sections/faq/default";
import Footer from "../components/sections/footer/default";
import Hero from "../components/sections/hero/default";
import Navbar from "../components/sections/navbar/default";
import { LayoutLines } from "../components/ui/layout-lines";
import { PhonePair } from "../components/ui/phone-pair";

export default function Home() {
  return (
    <main className="text-foreground min-h-screen w-full">
      <LayoutLines />
      <Navbar />
      {/* Section's default top padding stacks with the hero's own pt-16 and put
          the first line ~260px down the page; this pulls it to ~150. */}
      <Hero
        className="pt-4 sm:pt-4 md:pt-4"
        subdescription="Join on iOS — or explore our free library of high-yield video recordings."
        media={<PhonePair />}
      />
      <Audiences className="pt-2 sm:pt-6 md:pt-10" />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
