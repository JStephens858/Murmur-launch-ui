import type { Metadata } from "next";
import { Suspense } from "react";

import PortalExplore from "@/components/portal/explore";

export const metadata: Metadata = { title: "Explore" };

// Suspense: Explore reads the hashtag filter from the URL (useSearchParams),
// which Next requires to be inside a boundary on a prerendered page.
export default function ExplorePage() {
  return (
    <Suspense>
      <PortalExplore />
    </Suspense>
  );
}
