import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Profile" };

/** Destination of notification taps; placeholder until this section is built. */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <>
      <PortalPageHeader title="Profile" />
      <PortalPlaceholder>
        The profile of user <code className="text-xs">{userId}</code> will
        appear here.
      </PortalPlaceholder>
    </>
  );
}
