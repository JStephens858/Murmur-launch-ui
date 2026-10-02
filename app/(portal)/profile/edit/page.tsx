import type { Metadata } from "next";

import EditProfile from "@/components/portal/edit-profile";

export const metadata: Metadata = { title: "Edit Profile" };

/** The app's EditProfileView: the signed-in physician edits their own profile. */
export default function EditProfilePage() {
  return <EditProfile />;
}
