import type { Metadata } from "next";

import PortalVideos from "@/components/portal/videos";

export const metadata: Metadata = { title: "Videos" };

export default function WatchPage() {
  return <PortalVideos />;
}
