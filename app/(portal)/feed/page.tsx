import type { Metadata } from "next";

import Feed from "@/components/portal/feed";
import PortalPageHeader from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <>
      <PortalPageHeader title="Feed" />
      <Feed />
    </>
  );
}
