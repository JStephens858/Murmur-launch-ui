import type { Metadata } from "next";

import BackButton from "@/components/portal/back-button";
import PortalPageHeader, {
  PortalPlaceholder,
} from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Edit Profile" };

/** Placeholder; the app's EditProfileView (updateUser) is still to be ported. */
export default function EditProfilePage() {
  return (
    <>
      <PortalPageHeader
        title="Edit Profile"
        leading={<BackButton fallback="/profile" />}
      />
      <PortalPlaceholder>
        Editing your profile will be available here soon.
      </PortalPlaceholder>
    </>
  );
}
