import type { Metadata } from "next";

import NewConversation from "@/components/portal/new-conversation";

export const metadata: Metadata = { title: "New Group Chat" };

export default function NewConversationPage() {
  return <NewConversation />;
}
