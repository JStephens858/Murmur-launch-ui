import type { Metadata } from "next";

import GroupMembers from "@/components/portal/group-members";

export const metadata: Metadata = { title: "Members" };

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return <GroupMembers postGroupId={postGroupId} />;
}
