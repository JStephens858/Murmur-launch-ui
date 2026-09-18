"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatCount, formatDurationMs, formatTimeAgo } from "@/lib/format";
import { prefetchFullPost } from "@/lib/portal/feed";
import {
  useHashtag,
  useMediaElements,
  usePost,
  usePostGroup,
  useUser,
} from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import { TextBadgeCheckmarkIcon } from "./icons";

/* User media hosts are unbounded; plain <img>, see avatar.tsx. */
/* eslint-disable @next/next/no-img-element */

/** How long a card sits on screen before its full post is prefetched. */
const VISIBLE_PREFETCH_MS = 800;

export function postDetailHref(postId: string) {
  return `/postDetail/${postId}`;
}

function HashtagChip({ hashtagId }: { hashtagId: string }) {
  const tag = useHashtag(hashtagId);
  if (!tag) return null;
  return (
    <span className="text-accent-foreground bg-accent rounded-full px-2.5 py-0.5 text-xs font-medium">
      #{tag.hashtag}
    </span>
  );
}

export function Counter({
  icon: Icon,
  count,
  active,
  label,
}: {
  icon: typeof Heart;
  count: number | null | undefined;
  active?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-sm tabular-nums",
        active ? "text-primary" : "text-muted-foreground",
      )}
      aria-label={`${count ?? 0} ${label}`}
    >
      <Icon
        className="size-4"
        fill={active ? "currentColor" : "none"}
        aria-hidden
      />
      {count ? formatCount(count) : null}
    </span>
  );
}

/**
 * One feed row, X-style: avatar left, everything else right. The whole
 * card is a link to the post page via a stretched overlay; hashtag chips
 * and counters sit above it so they stay individually targetable later.
 *
 * Prefetch: the full post (media, comments, quoted post) is fetched into
 * the store on hover or focus, and once the card has been on screen for a
 * moment, so opening it is instant. The app instead fetches on tap behind a
 * spinner.
 */
export default function PostCard({ postId }: { postId: string }) {
  const client = useQueryClient();
  const post = usePost(postId);
  const author = useUser(post?.creatorUserId);
  const group = usePostGroup(post?.postGroupId);
  // Known once the full post is in the store (the feed row only has ids),
  // which the visibility prefetch usually makes true before it matters.
  const elements = useMediaElements(post?.mediaElementIds ?? []);
  const hasPoll = elements.some((e) => e?.mediaType === "poll");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(
            () => prefetchFullPost(client, postId),
            VISIBLE_PREFETCH_MS,
          );
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [client, postId]);

  if (!post || post.isDeleted) return null;

  const prefetch = () => prefetchFullPost(client, postId);
  const extraMedia = Math.max(0, post.mediaElementIds.length - 1);
  const when = post.publishedDate ?? post.createdDate;

  return (
    <article
      ref={ref}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className="border-border/40 hover:bg-foreground/[0.03] relative flex gap-3 border-b px-4 py-3 transition-colors"
    >
      {/* z-[1]: above the thumbnail wrapper, which is positioned for its
          badge and would otherwise paint over the link and eat the click.
          Interactive children sit at z-10, above both. */}
      <Link
        href={postDetailHref(postId)}
        className="absolute inset-0 z-[1]"
        aria-label={post.title || "Open post"}
      />
      <Link
        href={author ? `/profile/${author.userId}` : "#"}
        className="relative z-10 mt-0.5 shrink-0"
        aria-label={
          author
            ? `${author.displayName || author.username}'s profile`
            : undefined
        }
      >
        <Avatar user={author} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link
            href={author ? `/profile/${author.userId}` : "#"}
            className="text-foreground relative z-10 font-bold hover:underline"
          >
            {author?.displayName || author?.username || "…"}
          </Link>
          {author?.username && <span>@{author.username}</span>}
          <span aria-hidden>·</span>
          <time dateTime={when} title={new Date(when).toLocaleString()}>
            {formatTimeAgo(when)}
          </time>
          {group?.groupName && (
            <Link
              href={`/groups/${group.postGroupId}`}
              className="text-accent-alt relative z-10 ml-auto truncate text-xs hover:underline"
            >
              {group.groupName}
            </Link>
          )}
        </div>

        {post.title && (
          <h2 className="leading-snug font-semibold">{post.title}</h2>
        )}
        {post.postText && (
          <p className="line-clamp-6 leading-relaxed whitespace-pre-line">
            {post.postText}
          </p>
        )}

        {post.mediaPreviewUrl && (
          <div className="border-border/40 relative mt-1 overflow-hidden rounded-2xl border">
            <img
              src={post.mediaPreviewUrl}
              alt=""
              loading="lazy"
              className="max-h-[420px] w-full object-cover"
            />
            {extraMedia > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                +{extraMedia} more
              </span>
            )}
          </div>
        )}

        {hasPoll && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <TextBadgeCheckmarkIcon className="size-4" />
            Take the poll
          </span>
        )}

        {post.hashtagIds && post.hashtagIds.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {post.hashtagIds.map((id) => (
              <HashtagChip key={id} hashtagId={id} />
            ))}
          </div>
        )}

        <div className="relative z-10 mt-1 flex items-center gap-6">
          <Counter
            icon={MessageCircle}
            count={post.numComments}
            label="comments"
          />
          <Counter
            icon={Heart}
            count={post.numLikes}
            active={!!post.likedByMe}
            label="likes"
          />
          <Counter
            icon={Bookmark}
            count={post.numBookmarks}
            active={!!post.bookmarkedByMe}
            label="bookmarks"
          />
        </div>
      </div>
    </article>
  );
}

/** Used by the feed while the first page loads. */
export function PostCardSkeleton() {
  return (
    <div
      className="border-border/40 flex animate-pulse gap-3 border-b px-4 py-3"
      aria-hidden
    >
      <span className="bg-muted size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <span className="bg-muted h-3 w-1/3 rounded" />
        <span className="bg-muted h-3 w-5/6 rounded" />
        <span className="bg-muted h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

export { formatDurationMs };
