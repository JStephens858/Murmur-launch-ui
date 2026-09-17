import type { Metadata } from "next";

import MessagesList from "@/components/portal/messages-list";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <MessagesList />;
}
