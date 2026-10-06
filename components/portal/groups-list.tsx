"use client";

import { Lock, Megaphone } from "lucide-react";
import Link from "next/link";

import { useCurrentUser } from "@/lib/portal/current-user";
import {
  useGroups,
  userCanAccess,
  userCanSeeInGroups,
} from "@/lib/portal/groups";
import { usePostGroup } from "@/lib/portal/store";
import type { PortalPostGroup } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import { PortalError } from "./feed";
import GroupIcon from "./group-icon";
import GroupJoinButton from "./group-join-button";
import PortalPageHeader from "./page-header";

/** The bits of a row that don't depend on membership: name and flags. */
export function GroupTitle({
  group,
  className,
}: {
  group: PortalPostGroup;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="font-semibold">{group.groupName}</p>
      {group.groupType === "private" && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs italic">
          <Lock className="size-3" aria-hidden /> Private group
        </p>
      )}
      {(group.sponsored ?? 0) > 0 && group.sponsor && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Megaphone className="size-3" aria-hidden /> {group.sponsor}
        </p>
      )}
    </div>
  );
}

function GroupRow({ postGroupId }: { postGroupId: string }) {
  const group = usePostGroup(postGroupId);
  const { data: user } = useCurrentUser();
  if (!group) return null;
  const accessible = userCanAccess(group, user);
  const count = group.memberCount ?? 0;

  const head = (
    <div className="flex items-center gap-3">
      <GroupIcon iconUrl={group.iconUrl} />
      <GroupTitle group={group} className="min-w-0 flex-1" />
      {accessible && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {count} {count === 1 ? "member" : "members"}
        </span>
      )}
    </div>
  );

  return (
    <li
      className={cn(
        "border-border/40 relative flex flex-col gap-2 border-b px-4 py-3",
        accessible && "hover:bg-foreground/[0.03] transition-colors",
      )}
    >
      {/* The whole row opens the group, via a stretched link under the
          join button. As in the app, a private group you can't enter
          isn't tappable. */}
      {accessible && (
        <Link
          href={`/groups/${postGroupId}`}
          className="absolute inset-0"
          aria-label={group.groupName}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{head}</div>
        <div className="relative z-10">
          <GroupJoinButton group={group} />
        </div>
      </div>
      {group.description && (
        <p className="text-muted-foreground text-sm whitespace-pre-line">
          {group.description}
        </p>
      )}
    </li>
  );
}

/**
 * GroupListView: every group in one scroll, subscribed ones first under
 * the app's own headings, then the rest the reader is allowed to see.
 */
export default function GroupsList() {
  const groups = useGroups();
  const { data: user } = useCurrentUser();

  return (
    <>
      <PortalPageHeader title="Groups" />
      {groups.status === "pending" && (
        <p className="text-muted-foreground px-4 py-8" aria-busy="true">
          Loading groups…
        </p>
      )}
      {groups.status === "error" && (
        <PortalError error={groups.error} retry={() => groups.refetch()} />
      )}
      {groups.data && <Sections ids={groups.data} user={user} />}
    </>
  );
}

function Sections({
  ids,
  user,
}: {
  ids: string[];
  user: ReturnType<typeof useCurrentUser>["data"];
}) {
  // Read the rows from the store so join/leave re-sections them live.
  return <SectionedRows ids={ids} user={user} />;
}

function SectionedRows({
  ids,
  user,
}: {
  ids: string[];
  user: ReturnType<typeof useCurrentUser>["data"];
}) {
  return (
    <>
      <Section
        title="You're subscribed to these groups:"
        ids={ids}
        include={(g) => !!g.subscribed}
        user={user}
      />
      <Section
        title="Other groups you might be interested in:"
        ids={ids}
        include={(g) => !g.subscribed && userCanSeeInGroups(g, user)}
        user={user}
      />
    </>
  );
}

function Section({
  title,
  ids,
  include,
  user,
}: {
  title: string;
  ids: string[];
  include: (g: PortalPostGroup) => boolean;
  user: ReturnType<typeof useCurrentUser>["data"];
}) {
  return (
    <SectionBody
      title={title}
      ids={ids}
      include={include}
      userLoaded={user !== undefined}
    />
  );
}

function SectionBody({
  title,
  ids,
  include,
  userLoaded,
}: {
  title: string;
  ids: string[];
  include: (g: PortalPostGroup) => boolean;
  userLoaded: boolean;
}) {
  const rows = ids.map((id) => (
    <MaybeRow key={id} postGroupId={id} include={include} />
  ));
  if (!userLoaded) return null;
  return (
    <section>
      <h2 className="text-muted-foreground px-4 pt-5 pb-2 text-sm font-medium">
        {title}
      </h2>
      <ul>{rows}</ul>
    </section>
  );
}

function MaybeRow({
  postGroupId,
  include,
}: {
  postGroupId: string;
  include: (g: PortalPostGroup) => boolean;
}) {
  const group = usePostGroup(postGroupId);
  if (!group || !include(group)) return null;
  return <GroupRow postGroupId={postGroupId} />;
}
