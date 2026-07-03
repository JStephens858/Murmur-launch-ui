import Audiences from "../components/sections/audiences/default";
import CTA from "../components/sections/cta/default";
import FAQ from "../components/sections/faq/default";
import Footer from "../components/sections/footer/default";
import Hero from "../components/sections/hero/default";
import Items from "../components/sections/items/default";
import Navbar from "../components/sections/navbar/default";
import { LayoutLines } from "../components/ui/layout-lines";

export default function Home() {
  return (
    <main className="text-foreground min-h-screen w-full">
      <LayoutLines />
      <Navbar />
      <Hero />
      <Items />
      <Audiences />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
