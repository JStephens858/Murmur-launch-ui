"use client";

import { useCurrentUser } from "@/lib/portal/current-user";

import Profile from "./profile";

/** /profile/<id>: someone's profile — or your own, if the id is yours. */
export default function OtherProfile({ userId }: { userId: string }) {
  const { data: me } = useCurrentUser();
  return <Profile userId={userId} isOwn={me?.userId === userId} />;
}
