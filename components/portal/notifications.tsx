"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type ComponentType, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/format";
import {
  markSeenLocally,
  notificationHref,
  notificationLines,
  type NotificationType,
  type PortalNotification,
  useClearNotifications,
  useMarkNotificationsSeen,
  useNotifications,
} from "@/lib/portal/notifications";
import { useEnsureUsers } from "@/lib/portal/profile";
import { useUser } from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import { avatarInitial } from "./avatar";
import { PortalError } from "./feed";
import {
  AtIcon,
  BookmarkFillIcon,
  BubblesFillIcon,
  EnvelopeFillIcon,
  FigureWaveIcon,
  GridBubbleFillIcon,
  HeartFillIcon,
  type IconProps,
  PersonQuestionIcon,
  QuestionMarkIcon,
  ThumbsUpFillIcon,
  WarningTriangleIcon,
} from "./icons";
import PortalPageHeader from "./page-header";

/* Avatars come from the API's media hosts; plain <img>, see avatar.tsx. */
/* eslint-disable @next/next/no-img-element */

/** The app's icon per kind (IconPicker.notificationType). */
const KIND_ICON: Partial<Record<NotificationType, ComponentType<IconProps>>> = {
  bookmarkPost: BookmarkFillIcon,
  likePost: HeartFillIcon,
  newFollower: FigureWaveIcon,
  newPost: GridBubbleFillIcon,
  replyPost: BubblesFillIcon,
  userMentioned: AtIcon,
  newDmPost: EnvelopeFillIcon,
  replyDmPost: EnvelopeFillIcon,
  newUser: PersonQuestionIcon,
  systemAnnouncement: WarningTriangleIcon,
  postGroupAction: ThumbsUpFillIcon,
};

const LOAD_AHEAD = "600px";

function NotificationRow({
  notification: n,
}: {
  notification: PortalNotification;
}) {
  const client = useQueryClient();
  const href = notificationHref(n);
  const unread = n.seen === 0;
  const Kind = KIND_ICON[n.notificationType] ?? QuestionMarkIcon;
  const lines = notificationLines(n);
  const creator = useUser(n.notificationCreatorId);
  const image =
    n.notificationImageUrl ??
    creator?.profilePicThumbnailUrl ??
    creator?.profilePicMediumUrl ??
    null;

  const body = (
    <>
      {/* self-start: as a flex item the wrapper would otherwise stretch to
          the row's height, dropping the kind badge below the avatar. */}
      <span className="relative shrink-0 self-start">
        <span
          className={cn(
            "border-primary/70 bg-muted text-muted-foreground flex size-12 items-center justify-center overflow-hidden rounded-full border-2 text-base font-semibold shadow-sm",
            !unread && "opacity-60",
          )}
          aria-hidden
        >
          {image ? (
            <img
              src={image}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            // No picture: the creator's initial, as avatars show it in the
            // feed (blank until the creator has loaded).
            creator && avatarInitial(creator)
          )}
        </span>
        <span
          className={cn(
            "bg-card border-border/40 text-foreground absolute -right-1.5 -bottom-1 flex size-6 items-center justify-center rounded-full border shadow-sm",
            !unread && "opacity-90",
          )}
          aria-hidden
        >
          <Kind className="size-4" />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {lines.title && (
          <span
            className={cn(
              "leading-snug font-semibold",
              !unread && "text-muted-foreground",
            )}
          >
            {lines.title}
          </span>
        )}
        {lines.subtitle && (
          <span className="text-muted-foreground text-sm leading-snug">
            {lines.subtitle}
          </span>
        )}
        <span
          className={cn(
            "leading-snug",
            unread ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {lines.body}
        </span>
        <time
          dateTime={n.createdDate}
          title={new Date(n.createdDate).toLocaleString()}
          className={cn(
            "self-end text-sm",
            unread ? "text-foreground/80" : "text-muted-foreground",
          )}
        >
          {formatTimeAgo(n.createdDate)}
        </time>
      </span>
    </>
  );

  const rowClass = cn(
    "border-border/40 flex w-full gap-4 border-b px-4 py-3 text-left transition-colors",
    href && "hover:bg-foreground/[0.03]",
    unread && "bg-primary/[0.04]",
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={rowClass}
          onClick={() => markSeenLocally(client, n.notificationId)}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

function RowSkeleton() {
  return (
    <li
      className="border-border/40 flex animate-pulse gap-4 border-b px-4 py-3"
      aria-hidden
    >
      <span className="bg-muted size-12 shrink-0 rounded-full" />
      <span className="flex flex-1 flex-col gap-2 pt-1">
        <span className="bg-muted h-3 w-5/6 rounded" />
        <span className="bg-muted h-3 w-1/4 self-end rounded" />
      </span>
    </li>
  );
}

/**
 * The Notifications screen: header with "Clear all", a flat list in server
 * order, load-more ahead of the end, and mark-seen once the first page is in.
 */
export default function Notifications() {
  const list = useNotifications();
  const markSeen = useMarkNotificationsSeen();
  const clearAll = useClearNotifications();
  const sentinel = useRef<HTMLLIElement>(null);
  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = list;

  const notifications = (() => {
    const seen = new Set<string>();
    const out: PortalNotification[] = [];
    for (const page of list.data?.pages ?? []) {
      for (const n of page.notifications) {
        if (!seen.has(n.notificationId)) {
          seen.add(n.notificationId);
          out.push(n);
        }
      }
    }
    return out;
  })();
  // Notification responses come with an empty store, so creators with no
  // picture are fetched (only those missing) for their initial.
  useEnsureUsers([
    ...new Set(
      notifications
        .filter((n) => !n.notificationImageUrl && n.notificationCreatorId)
        .map((n) => n.notificationCreatorId as string),
    ),
  ]);

  const newest = notifications[0]?.createdDate;
  const anyUnread = notifications.some((n) => n.seen === 0);

  // As the app does at the end of every refresh: mark everything up to the
  // newest row seen, once per fetch of the first page.
  const seenUpTo = useRef<string | null>(null);
  const markSeenMutate = markSeen.mutate;
  useEffect(() => {
    if (!newest || !anyUnread || seenUpTo.current === newest) return;
    seenUpTo.current = newest;
    markSeenMutate(newest);
  }, [newest, anyUnread, markSeenMutate]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Not while any fetch is running: asking for the next page cancels
        // an in-flight refetch of the first, and a reload that shrinks the
        // list can bring this sentinel into view mid-refetch.
        if (entry.isIntersecting && !isFetching) fetchNextPage();
      },
      { rootMargin: LOAD_AHEAD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching]);

  return (
    <>
      <PortalPageHeader
        title="Notifications"
        trailing={
          notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={clearAll.isPending}
              onClick={() => newest && clearAll.mutate(newest)}
            >
              Clear all
            </Button>
          )
        }
      />
      {list.status === "pending" && (
        <ul aria-busy="true" aria-label="Loading notifications">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </ul>
      )}
      {list.isError && !list.data && (
        <PortalError error={list.error} retry={() => list.refetch()} />
      )}
      {list.status === "success" && notifications.length === 0 && (
        <p className="text-muted-foreground px-4 py-12 text-center">
          You don&apos;t have any notifications
        </p>
      )}
      {notifications.length > 0 && (
        <ul>
          {notifications.map((n) => (
            <NotificationRow key={n.notificationId} notification={n} />
          ))}
          <li ref={sentinel} aria-hidden />
          {isFetchingNextPage && <RowSkeleton />}
        </ul>
      )}
      {list.isError && list.data && (
        <PortalError error={list.error} retry={() => list.fetchNextPage()} />
      )}
      {clearAll.isError && <PortalError error={clearAll.error} />}
    </>
  );
}
