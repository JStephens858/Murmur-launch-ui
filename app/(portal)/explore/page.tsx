import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <>
      <PortalPageHeader title="Explore" />
      <PortalPlaceholder>
        Browse cases, groups and colleagues here.
      </PortalPlaceholder>
    </>
  );
}
