"use client";

import {
  Calendar,
  Check,
  Hand,
  Heart,
  Link2,
  Mail,
  MapPin,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { useCurrentUser } from "@/lib/portal/current-user";
import { useCreateConversation } from "@/lib/portal/messages";
import {
  ANONYMOUS_USER_ID,
  type CVItem,
  useCVItems,
  useEnsureUsers,
  useFollowers,
  useFollowUser,
  useProfileCounters,
  useUserPosts,
} from "@/lib/portal/profile";
import { useUser } from "@/lib/portal/store";
import type { PortalUser } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import BackButton from "./back-button";
import { PortalError } from "./feed";
import PortalPageHeader from "./page-header";
import PostCard, { PostCardSkeleton } from "./post-card";

/**
 * ProfileView2: one screen for yourself and for others. Your own adds Edit
 * Profile; someone else's adds Follow and, for doctors, a message button.
 * Everything else — details, counters, the Profile/Experience tabs and the
 * Posts/Bookmarks/Following/Followers lists — is the same for both.
 */
export default function Profile({
  userId,
  isOwn,
}: {
  userId: string;
  isOwn: boolean;
}) {
  const { data: me } = useCurrentUser();
  const ensure = useEnsureUsers([userId]);
  const user = useUser(userId);
  useProfileCounters(userId);
  const [tab, setTab] = useState<"profile" | "experience">("profile");

  if (!user) {
    if (ensure.isError)
      return (
        <PortalError error={ensure.error} retry={() => ensure.refetch()} />
      );
    return (
      <>
        <PortalPageHeader
          title="Profile"
          leading={!isOwn && <BackButton fallback="/feed" />}
        />
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      </>
    );
  }
  if (user.isDeleted) {
    return (
      <>
        <PortalPageHeader
          title="Profile"
          leading={!isOwn && <BackButton fallback="/feed" />}
        />
        <p className="text-muted-foreground px-4 py-8">
          This account has been deleted.
        </p>
      </>
    );
  }

  return (
    <>
      <PortalPageHeader
        title={user.displayName || `@${user.username}`}
        leading={!isOwn && <BackButton fallback="/feed" />}
      />
      <Header user={user} isOwn={isOwn} me={me} />
      <Details user={user} />
      <div role="tablist" className="border-border/40 mt-2 flex border-b">
        {(["profile", "experience"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-3 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "border-primary text-foreground border-b-2"
                : "text-muted-foreground hover:bg-foreground/[0.03]",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <>
          <More user={user} />
          <Counters user={user} />
          <Lists userId={userId} me={me} />
        </>
      ) : (
        <Experience userId={userId} isOwn={isOwn} />
      )}
    </>
  );
}

function Header({
  user,
  isOwn,
  me,
}: {
  user: PortalUser;
  isOwn: boolean;
  me: ReturnType<typeof useCurrentUser>["data"];
}) {
  const router = useRouter();
  const create = useCreateConversation();
  const canMessage =
    !isOwn && user.userId !== ANONYMOUS_USER_ID && me?.userClass === "doctor";
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-4">
      <div className="relative">
        <Avatar user={user} className="size-28 text-3xl" />
        <div className="absolute -bottom-2 -left-1">
          {isOwn ? (
            <Button asChild variant="glow" size="sm" className="rounded-full">
              <Link href="/profile/edit">Edit Profile</Link>
            </Button>
          ) : (
            <FollowButton userId={user.userId} />
          )}
        </div>
      </div>
      {canMessage && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Message"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              { memberUserIds: [user.userId], text: "" },
              { onSuccess: (id) => router.push(`/messages/${id}`) },
            )
          }
        >
          <Mail className="size-5" />
        </Button>
      )}
    </div>
  );
}

/** "Follow" outlined, "Following" filled; one click toggles. Hidden for yourself. */
export function FollowButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { data: me } = useCurrentUser();
  const mine = useFollowers(me?.userId);
  const follow = useFollowUser(me?.userId);
  if (!me || me.userId === userId || !mine.data) return null;
  const following = mine.data.followingIds.includes(userId);
  return (
    <Button
      variant={following ? "default" : "outline"}
      size="sm"
      aria-pressed={following}
      disabled={follow.isPending}
      onClick={() => follow.mutate({ userId, follow: !following })}
      className={cn("rounded-full", className)}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}

function Details({ user }: { user: PortalUser }) {
  const joined = user.createdDate
    ? new Date(user.createdDate).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <div className="flex flex-col gap-1 px-4 pt-4">
      <p className="text-xl font-bold">{user.displayName}</p>
      <p className="text-muted-foreground">@{user.username}</p>
      {user.specialty && <p className="mt-1">{user.specialty}</p>}
      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {user.link && (
          <a
            href={user.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-foreground flex items-center gap-1 hover:underline"
          >
            <Link2 className="size-4" aria-hidden />{" "}
            {user.link.replace(/^https?:\/\//, "")}
          </a>
        )}
        {user.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-4" aria-hidden /> {user.location}
          </span>
        )}
        {joined && (
          <span className="flex items-center gap-1">
            <Calendar className="size-4" aria-hidden /> Joined {joined}
          </span>
        )}
        {user.invitedByUsername && (
          <span className="flex items-center gap-1">
            <Ticket className="size-4" aria-hidden /> Invited by: @
            {user.invitedByUsername}
          </span>
        )}
      </div>
    </div>
  );
}

/** ProfileMoreView: labelled blocks, shown only when there's something in them. */
function More({ user }: { user: PortalUser }) {
  const blocks = [
    ["Disclosures", user.disclosures],
    ["Interests", user.interests],
    ["Bio", user.bio],
  ].filter((b): b is [string, string] => !!b[1] && b[1].trim().length > 2);
  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-4 text-sm">
        No profile information added yet
      </p>
    );
  }
  return (
    <dl className="flex flex-col gap-3 px-4 py-4">
      {blocks.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {label}:
          </dt>
          <dd className="whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Counters({ user }: { user: PortalUser }) {
  const items = [
    { icon: Heart, label: "Post Likes", value: user.likedPostCount ?? 0 },
    { icon: Check, label: "Best Answers", value: user.bestAnswerCount ?? 0 },
    {
      icon: Hand,
      label: "Posts of the Week",
      value: user.postOfTheWeekCount ?? 0,
    },
  ];
  return (
    <div className="border-border/40 flex justify-around border-y px-4 py-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-0.5 text-center"
        >
          <span className="flex items-center gap-1 text-lg font-bold tabular-nums">
            <Icon className="text-primary size-4" aria-hidden />{" "}
            {formatCount(value)}
          </span>
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}

type ListTab = "posts" | "bookmarks" | "following" | "followers";

function Lists({
  userId,
  me,
}: {
  userId: string;
  me: ReturnType<typeof useCurrentUser>["data"];
}) {
  const [tab, setTab] = useState<ListTab>("posts");
  const posts = useUserPosts(userId, "posts");
  const bookmarks = useUserPosts(userId, "bookmarks");
  const followers = useFollowers(userId);
  const counts: Record<ListTab, number | undefined> = {
    posts: posts.data?.pages[0]?.total,
    bookmarks: bookmarks.data?.pages[0]?.total,
    following: followers.data?.followingIds.length,
    followers: followers.data?.followerIds.length,
  };
  return (
    <>
      <div
        role="tablist"
        className="border-border/40 flex overflow-x-auto border-b"
      >
        {(["posts", "bookmarks", "following", "followers"] as ListTab[]).map(
          (t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 px-2 py-3 text-sm font-medium whitespace-nowrap capitalize transition-colors",
                tab === t
                  ? "border-primary text-foreground border-b-2"
                  : "text-muted-foreground hover:bg-foreground/[0.03]",
              )}
            >
              {t}
              {counts[t] !== undefined && (
                <span className="text-muted-foreground ml-1 tabular-nums">
                  ({formatCount(counts[t]!)})
                </span>
              )}
            </button>
          ),
        )}
      </div>
      {tab === "posts" && <PostsTab query={posts} emptyText="No posts yet" />}
      {tab === "bookmarks" && (
        <PostsTab query={bookmarks} emptyText="No bookmarks yet" />
      )}
      {tab === "following" && (
        <PeopleTab
          ids={followers.data?.followingIds ?? []}
          loading={followers.isPending}
          me={me}
        />
      )}
      {tab === "followers" && (
        <PeopleTab
          ids={followers.data?.followerIds ?? []}
          loading={followers.isPending}
          me={me}
        />
      )}
    </>
  );
}

function PostsTab({
  query,
  emptyText,
}: {
  query: ReturnType<typeof useUserPosts>;
  emptyText: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const ids = [...new Set((query.data?.pages ?? []).flatMap((p) => p.postIds))];
  if (query.status === "pending") return <PostCardSkeleton />;
  if (query.isError && !query.data)
    return <PortalError error={query.error} retry={() => query.refetch()} />;
  if (ids.length === 0)
    return <p className="text-muted-foreground px-4 py-8">{emptyText}</p>;
  return (
    <div>
      {ids.map((id) => (
        <PostCard key={id} postId={id} />
      ))}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && (
        <p className="text-muted-foreground px-4 py-3 text-sm">Loading...</p>
      )}
    </div>
  );
}

function PeopleTab({
  ids,
  loading,
  me,
}: {
  ids: string[];
  loading: boolean;
  me: ReturnType<typeof useCurrentUser>["data"];
}) {
  useEnsureUsers(ids);
  if (loading)
    return <p className="text-muted-foreground px-4 py-8">Loading...</p>;
  if (ids.length === 0)
    return <p className="text-muted-foreground px-4 py-8">No one yet</p>;
  return (
    <ul className="px-2 py-2">
      {ids.map((id) => (
        <PersonFollowRow key={id} userId={id} hideFollow={id === me?.userId} />
      ))}
    </ul>
  );
}

/** FollowerUserCell: avatar, name, handle, a Follow button, tap to profile. */
function PersonFollowRow({
  userId,
  hideFollow,
}: {
  userId: string;
  hideFollow: boolean;
}) {
  const user = useUser(userId);
  return (
    <li className="flex items-center gap-2">
      <Link
        href={`/profile/${userId}`}
        className="hover:bg-foreground/[0.03] flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2"
      >
        <Avatar user={user} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">
            {user?.displayName || user?.username || "…"}
          </span>
          {user?.username && (
            <span className="text-muted-foreground truncate text-sm">
              @{user.username}
            </span>
          )}
        </span>
      </Link>
      {!hideFollow && <FollowButton userId={userId} className="mr-2" />}
    </li>
  );
}

function Experience({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const cv = useCVItems(userId);
  if (cv.status === "pending")
    return <p className="text-muted-foreground px-4 py-8">Loading...</p>;
  if (cv.isError)
    return <PortalError error={cv.error} retry={() => cv.refetch()} />;
  const items = cv.data ?? [];
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8">
        {isOwn
          ? "Add your training, practice, and credentials so colleagues can find common ground."
          : "No experience added yet."}
      </p>
    );
  }
  const groups = new Map<string, CVItem[]>();
  for (const item of items)
    groups.set(item.itemTypeName, [
      ...(groups.get(item.itemTypeName) ?? []),
      item,
    ]);
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {[...groups].map(([name, list]) => (
        <section key={name} className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-medium uppercase">
            {name}
          </h2>
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <li
                key={item.itemId}
                className="border-border/60 bg-card/50 rounded-2xl border p-3"
              >
                <p className="font-semibold">
                  {item.title ||
                    item.companyName ||
                    item.discipline ||
                    item.practiceType}
                </p>
                <p className="text-muted-foreground text-sm">
                  {[
                    item.companyName && item.title ? item.companyName : null,
                    item.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(item.start || item.end) && (
                  <p className="text-muted-foreground text-sm">
                    {item.start ?? ""}
                    {item.start || item.end ? " – " : ""}
                    {item.isCurrent ? "present" : (item.end ?? "")}
                  </p>
                )}
                {item.description && (
                  <p className="mt-1 text-sm whitespace-pre-line">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
