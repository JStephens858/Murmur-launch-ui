import { ReactNode } from "react";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";

/**
 * Frame for the pages ported from Murmur-express.
 *
 * The originals were frozen Sapper snapshots — a blurred landing-image
 * backdrop, Montserrat/Ubuntu pulled from Google Fonts, ~2.5KB of inline CSS
 * duplicated across eight files, and a dead __SAPPER__ bootstrap pointing at a
 * bundle that 404s. None of that came over; these pages use the same navbar,
 * footer and section rhythm as the rest of the site.
 */
export default function LegacyPage({ children }: { children: ReactNode }) {
  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      {children}
      <Footer />
    </main>
  );
}
