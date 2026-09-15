"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import {
  useGroups,
  useModerators,
  useWatchingGroup,
} from "@/lib/portal/groups";
import { usePostGroup } from "@/lib/portal/store";
import { useUser } from "@/lib/portal/store";

import Avatar from "./avatar";
import BackButton from "./back-button";
import { PortalError } from "./feed";
import GroupIcon from "./group-icon";
import GroupJoinButton from "./group-join-button";
import { GroupTitle } from "./groups-list";
import PortalPageHeader from "./page-header";

/**
 * PostGroupDetailsView: icon and name, private/sponsor lines, description,
 * the long-form Join/Leave button, the "Watch this Group" toggle, and the
 * visible moderators. Membership requests for moderators aren't built.
 */
export default function GroupDetails({ postGroupId }: { postGroupId: string }) {
  const groups = useGroups();
  const group = usePostGroup(postGroupId);
  const moderators = useModerators(postGroupId);
  const watch = useWatchingGroup(postGroupId);

  return (
    <>
      <PortalPageHeader
        title="Group Details"
        leading={<BackButton fallback={`/groups/${postGroupId}`} />}
      />
      {!group?.groupName && groups.isError && (
        <PortalError error={groups.error} retry={() => groups.refetch()} />
      )}
      {group?.groupName && (
        <div className="flex flex-col gap-5 px-4 py-4">
          <div className="flex items-start gap-3">
            <GroupIcon iconUrl={group.iconUrl} className="size-14" />
            <GroupTitle group={group} className="min-w-0 flex-1 text-lg" />
          </div>
          {group.description && (
            <p className="leading-relaxed whitespace-pre-line">
              {group.description}
            </p>
          )}
          <div className="flex justify-end">
            <GroupJoinButton group={group} longForm />
          </div>
          <label className="border-border/40 flex items-center justify-between gap-3 border-y py-3">
            <span className="flex items-center gap-2">
              <Bell className="size-4" aria-hidden /> Watch this Group
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={watch.watching}
              disabled={!watch.loaded}
              onChange={(e) => watch.setWatching(e.target.checked)}
              className="accent-primary size-5"
            />
          </label>
          <section className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">
              Group Moderators:
            </h2>
            {moderators.status === "pending" && (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}
            {moderators.data && moderators.data.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No moderators listed.
              </p>
            )}
            <ul className="flex flex-col">
              {moderators.data?.map((m) => (
                <li key={m.userId}>
                  <PersonRow
                    userId={m.userId}
                    fallbackName={m.displayName}
                    fallbackUsername={m.username}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

/** FollowerUserCell without the follow button: avatar, name, handle. */
export function PersonRow({
  userId,
  fallbackName,
  fallbackUsername,
}: {
  userId: string;
  fallbackName?: string;
  fallbackUsername?: string;
}) {
  const user = useUser(userId);
  const name =
    user?.displayName ||
    fallbackName ||
    user?.username ||
    fallbackUsername ||
    "…";
  const handle = user?.username || fallbackUsername;
  return (
    <Link
      href={`/profile/${userId}`}
      className="hover:bg-foreground/[0.03] flex items-center gap-3 rounded-lg px-2 py-2"
    >
      <Avatar user={user} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold">{name}</span>
        {handle && (
          <span className="text-muted-foreground truncate text-sm">
            @{handle}
          </span>
        )}
      </span>
    </Link>
  );
}
