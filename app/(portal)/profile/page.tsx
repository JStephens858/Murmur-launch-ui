import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PortalPageHeader title="Profile" />
      <PortalPlaceholder>Your profile will appear here.</PortalPlaceholder>
    </>
  );
}
