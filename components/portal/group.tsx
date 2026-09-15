"use client";

import { Info, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/portal/current-user";
import { useFullPost } from "@/lib/portal/feed";
import {
  childCategories,
  pickerCategories,
  useGroups,
  useJoinGroup,
  userCanAccess,
} from "@/lib/portal/groups";
import { usePost, usePostGroup } from "@/lib/portal/store";
import type {
  PortalPostGroup,
  PortalPostGroupCategory,
} from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import BackButton from "./back-button";
import { PortalError, PostList } from "./feed";
import GroupJoinButton from "./group-join-button";
import { composeHref } from "./nav";
import PortalPageHeader from "./page-header";
import PostCard from "./post-card";

/**
 * A group's post list (PostListView2 in the app): members strip and
 * Group Details link, category tabs, the pinned post, a join prompt when
 * the reader isn't subscribed, and the posts. Browser-style categories
 * drill into their children with a breadcrumb back.
 */
export default function Group({ postGroupId }: { postGroupId: string }) {
  // Make sure the settings-level row is loaded even on a direct visit.
  const groups = useGroups();
  const group = usePostGroup(postGroupId);
  const { data: user } = useCurrentUser();

  if (!group?.groupName || group.subscribed === undefined) {
    if (groups.isError)
      return (
        <PortalError error={groups.error} retry={() => groups.refetch()} />
      );
    return (
      <>
        <PortalPageHeader
          title="Group"
          leading={<BackButton fallback="/groups" />}
        />
        <p className="text-muted-foreground px-4 py-8" aria-busy="true">
          Loading…
        </p>
      </>
    );
  }
  if (!userCanAccess(group, user)) {
    return (
      <>
        <PortalPageHeader
          title={group.groupName}
          leading={<BackButton fallback="/groups" />}
        />
        <p className="text-muted-foreground px-4 py-8">
          This is a private group.
        </p>
      </>
    );
  }
  return <GroupBody group={group} isDoctor={user?.userClass === "doctor"} />;
}

function GroupBody({
  group,
  isDoctor,
}: {
  group: PortalPostGroup;
  isDoctor: boolean;
}) {
  const tabs = pickerCategories(group);
  const [tab, setTab] = useState<PortalPostGroupCategory | null>(null);
  const [child, setChild] = useState<PortalPostGroupCategory | null>(null);
  const current = child ?? tab;
  const categoryIds = current ? [current.categoryId] : [];
  const showMembers = (group.canSeeGroupDetails ?? 1) === 1;
  const count = group.memberCount ?? 0;

  return (
    <>
      <PortalPageHeader
        title={group.groupName}
        leading={<BackButton fallback="/groups" />}
        trailing={
          (group.canPost ?? 0) > 0 && (
            <Button asChild variant="glow" size="sm">
              <Link href={`${composeHref}?group=${group.postGroupId}`}>
                Post
              </Link>
            </Button>
          )
        }
      />

      {showMembers && (
        <div className="border-border/40 flex items-center justify-between border-b px-4 py-3 text-sm">
          {isDoctor ? (
            <Link
              href={`/groups/${group.postGroupId}/members`}
              className="flex items-center gap-2 hover:underline"
            >
              <Users className="size-4" aria-hidden />
              {count} {count === 1 ? "member" : "members"}
            </Link>
          ) : (
            <span className="flex items-center gap-2">
              <Users className="size-4" aria-hidden />
              {count} {count === 1 ? "member" : "members"}
            </span>
          )}
          <Link
            href={`/groups/${group.postGroupId}/details`}
            className="flex items-center gap-2 hover:underline"
          >
            <Info className="size-4" aria-hidden />
            Group Details
          </Link>
        </div>
      )}

      {tabs.length > 0 && (
        <div
          role="tablist"
          aria-label="Categories"
          className="border-border/40 flex gap-1 overflow-x-auto border-b px-2 py-2"
        >
          {tabs.map((c) => (
            <button
              key={c.categoryId}
              type="button"
              role="tab"
              aria-selected={tab?.categoryId === c.categoryId}
              onClick={() => {
                setTab(tab?.categoryId === c.categoryId ? null : c);
                setChild(null);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                tab?.categoryId === c.categoryId
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-foreground/10",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {tab?.categoryDisplayStyle === "browser" && !child ? (
        <CategoryBrowser group={group} parent={tab} onPick={setChild} />
      ) : (
        <>
          {child && (
            <button
              type="button"
              onClick={() => setChild(null)}
              className="text-accent-foreground px-4 py-2 text-sm hover:underline"
            >
              ← Back to {tab?.name}
            </button>
          )}
          {!group.subscribed && <JoinPrompt group={group} />}
          {!current && group.pinnedPostId && (
            <PinnedPost postId={group.pinnedPostId} />
          )}
          <PostList
            postGroupId={group.postGroupId}
            categoryIds={categoryIds}
            excludePostId={current ? null : group.pinnedPostId}
            emptyText="No posts here yet."
          />
        </>
      )}
    </>
  );
}

function CategoryBrowser({
  group,
  parent,
  onPick,
}: {
  group: PortalPostGroup;
  parent: PortalPostGroupCategory;
  onPick: (c: PortalPostGroupCategory) => void;
}) {
  const children = childCategories(group, parent.categoryId);
  if (children.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8">
        Nothing in {parent.name} yet.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2">
      {children.map((c) => (
        <li key={c.categoryId}>
          <button
            type="button"
            onClick={() => onPick(c)}
            className="border-border/60 bg-card/50 hover:bg-foreground/[0.03] flex w-full flex-col gap-1 rounded-2xl border p-4 text-left"
          >
            <span className="font-semibold">{c.name}</span>
            {c.subtitle && (
              <span className="text-muted-foreground text-sm">
                {c.subtitle}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** JoinGroupPromptView, shown above the posts of a group you're not in. */
function JoinPrompt({ group }: { group: PortalPostGroup }) {
  const join = useJoinGroup();
  return (
    <div className="border-border/40 bg-accent/40 flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm">
      <p className="min-w-0 flex-1">
        You&apos;re not currently subscribed to &ldquo;{group.groupName}&rdquo;.
        Would you like to join this group and have it added to your feed?
      </p>
      {group.groupType === "private" ? (
        <GroupJoinButton group={group} />
      ) : (
        <Button
          variant="glow"
          size="sm"
          disabled={join.isPending}
          onClick={() =>
            join.mutate({ postGroupId: group.postGroupId, join: true })
          }
        >
          Join
        </Button>
      )}
    </div>
  );
}

function PinnedPost({ postId }: { postId: string }) {
  useFullPost(postId);
  const post = usePost(postId);
  if (!post) return null;
  return (
    <div className="bg-primary/[0.04]">
      <p className="text-muted-foreground px-4 pt-3 text-xs font-medium uppercase">
        Pinned
      </p>
      <PostCard postId={postId} />
    </div>
  );
}
