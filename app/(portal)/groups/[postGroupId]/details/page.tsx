import type { Metadata } from "next";

import GroupDetails from "@/components/portal/group-details";

export const metadata: Metadata = { title: "Group Details" };

export default async function GroupDetailsPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return <GroupDetails postGroupId={postGroupId} />;
}
