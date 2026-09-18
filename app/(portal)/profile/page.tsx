import type { Metadata } from "next";

import OwnProfile from "@/components/portal/own-profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <OwnProfile />;
}
