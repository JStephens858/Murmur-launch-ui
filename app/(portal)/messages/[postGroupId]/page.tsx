import type { Metadata } from "next";

import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Conversation" };

/** Destination of notification taps; placeholder until this section is built. */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return (
    <>
      <PortalPageHeader title="Conversation" />
      <PortalPlaceholder>
        The conversation <code className="text-xs">{postGroupId}</code> will
        appear here.
      </PortalPlaceholder>
    </>
  );
}
