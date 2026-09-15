import type { Metadata } from "next";

import Group from "@/components/portal/group";

export const metadata: Metadata = { title: "Group" };

export default async function GroupPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return <Group postGroupId={postGroupId} />;
}
