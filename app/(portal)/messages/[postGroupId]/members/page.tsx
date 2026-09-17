import type { Metadata } from "next";

import ConversationMembers from "@/components/portal/conversation-members";

export const metadata: Metadata = { title: "Group Participants" };

export default async function ConversationMembersPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return <ConversationMembers postGroupId={postGroupId} />;
}
