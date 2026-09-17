import type { Metadata } from "next";

import Conversation from "@/components/portal/conversation";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ postGroupId: string }>;
}) {
  const { postGroupId } = await params;
  return <Conversation postGroupId={postGroupId} />;
}
