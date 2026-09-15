import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <>
      <PortalPageHeader title="Groups" />
      <PortalPlaceholder>Your groups will appear here.</PortalPlaceholder>
    </>
  );
}
