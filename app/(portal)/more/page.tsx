import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <PortalPageHeader title="More" />
      <PortalPlaceholder>
        Settings, invitations, groups and everything else from the app menu will
        live here.
      </PortalPlaceholder>
    </>
  );
}
