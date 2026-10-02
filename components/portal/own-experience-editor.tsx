"use client";

import { useCurrentUser } from "@/lib/portal/current-user";

import { EditExperienceList } from "./experience";
import { PortalError } from "./feed";

/** Resolves the signed-in physician, then renders their experience editor. */
export default function OwnExperienceEditor() {
  const me = useCurrentUser();
  if (me.isError)
    return <PortalError error={me.error} retry={() => me.refetch()} />;
  if (!me.data)
    return <p className="text-muted-foreground px-4 py-8">Loading...</p>;
  return <EditExperienceList userId={me.data.userId} />;
}
