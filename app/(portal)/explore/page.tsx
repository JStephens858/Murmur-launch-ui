import type { Metadata } from "next";

import PortalExplore from "@/components/portal/explore";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <PortalExplore />;
}
