import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "New post" };

export default function ComposePage() {
  return (
    <>
      <PortalPageHeader title="New post" />
      <PortalPlaceholder>The post composer will appear here.</PortalPlaceholder>
    </>
  );
}
