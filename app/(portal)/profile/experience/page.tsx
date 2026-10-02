import type { Metadata } from "next";

import BackButton from "@/components/portal/back-button";
import OwnExperienceEditor from "@/components/portal/own-experience-editor";
import PortalPageHeader from "@/components/portal/page-header";

export const metadata: Metadata = { title: "Your experience" };

/** The app's EditExperienceListView: add, edit and remove your CV items. */
export default function EditExperiencePage() {
  return (
    <>
      <PortalPageHeader
        title="Your experience"
        leading={<BackButton fallback="/profile" />}
      />
      <OwnExperienceEditor />
    </>
  );
}
