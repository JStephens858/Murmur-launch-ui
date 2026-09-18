import type { Metadata } from "next";

import OtherProfile from "@/components/portal/other-profile";

export const metadata: Metadata = { title: "Profile" };

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <OtherProfile userId={userId} />;
}
