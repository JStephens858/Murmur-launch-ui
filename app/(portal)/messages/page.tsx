import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <>
      <PortalPageHeader title="Messages" />
      <PortalPlaceholder>
        Your direct messages will appear here.
      </PortalPlaceholder>
    </>
  );
}
