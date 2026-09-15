import type { Metadata } from "next";

import GroupsList from "@/components/portal/groups-list";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return <GroupsList />;
}
