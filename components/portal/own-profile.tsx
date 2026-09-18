"use client";

import { useCurrentUser } from "@/lib/portal/current-user";

import { PortalError } from "./feed";
import PortalPageHeader from "./page-header";
import Profile from "./profile";

/** /profile: the signed-in physician's own profile. */
export default function OwnProfile() {
  const me = useCurrentUser();
  if (me.isError)
    return <PortalError error={me.error} retry={() => me.refetch()} />;
  if (!me.data) {
    return (
      <>
        <PortalPageHeader title="Profile" />
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      </>
    );
  }
  return <Profile userId={me.data.userId} isOwn />;
}
