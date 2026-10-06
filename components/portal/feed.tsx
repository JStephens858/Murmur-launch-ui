"use client";

import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { usePostList } from "@/lib/portal/feed";
import { PortalAuthError } from "@/lib/portal/graphql";
import { FEED_GROUP_ID } from "@/lib/portal/queries";
import type { PortalHashtag } from "@/lib/portal/types";

import PostCard, { PostCardSkeleton } from "./post-card";
import UploadingPosts from "./uploading-posts";

/** How far below the viewport the next page starts loading. */
const LOAD_AHEAD = "800px";

export function PortalError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (error instanceof PortalAuthError) {
    const returnTo =
      typeof window === "undefined"
        ? "/feed"
        : window.location.pathname + window.location.search;
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-8">
        <p className="text-muted-foreground">Your session has expired.</p>
        <Button asChild variant="outline">
          <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in again
          </a>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8">
      <p className="text-destructive-foreground text-sm">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** The shape both post lists' infinite queries share. */
type PostIdPages = UseInfiniteQueryResult<
  InfiniteData<{ postIds: string[] }, unknown>,
  unknown
>;

/**
 * Pages of post ids rendered from the entity store. A sentinel below the
 * list requests the next page well before it scrolls into view, so the
 * reader rarely sees a spinner. The feed, the group pages and Explore are
 * all this with a different query behind it.
 */
export function InfinitePostList({
  query,
  emptyText = "Nothing here yet.",
  excludePostId,
  onHashtagClick,
  contextGroupId,
}: {
  query: PostIdPages;
  emptyText?: string;
  /** A post shown elsewhere on the page (the pinned post) to skip here. */
  excludePostId?: string | null;
  onHashtagClick?: (tag: PortalHashtag) => void;
  /** The group this list belongs to; its cards skip "Posted in". */
  contextGroupId?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const postIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const id of page.postIds) {
        if (!seen.has(id) && id !== excludePostId) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    return ids;
  }, [query.data, excludePostId]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: LOAD_AHEAD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (query.status === "pending" || (query.isError && !query.data)) {
    if (query.isError) {
      return <PortalError error={query.error} retry={() => query.refetch()} />;
    }
    return (
      <div aria-busy="true" aria-label="Loading posts">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (postIds.length === 0) {
    return <p className="text-muted-foreground px-4 py-8">{emptyText}</p>;
  }

  return (
    <div>
      {postIds.map((id) => (
        <PostCard
          key={id}
          postId={id}
          onHashtagClick={onHashtagClick}
          contextGroupId={contextGroupId}
        />
      ))}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && <PostCardSkeleton />}
      {!hasNextPage && (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          You&apos;re all caught up.
        </p>
      )}
      {query.isError && (
        <PortalError error={query.error} retry={() => query.fetchNextPage()} />
      )}
    </div>
  );
}

/**
 * A list of posts from one group: pages of post ids from getPostsInGroup.
 * The home feed is this with the sentinel group id.
 */
export function PostList({
  postGroupId,
  categoryIds = [],
  emptyText = "Nothing here yet.",
  excludePostId,
}: {
  postGroupId: string;
  categoryIds?: string[];
  emptyText?: string;
  /** A post shown elsewhere on the page (the pinned post) to skip here. */
  excludePostId?: string | null;
}) {
  const feed = usePostList(postGroupId, categoryIds);
  return (
    <>
      {categoryIds.length === 0 && <UploadingPosts postGroupId={postGroupId} />}
      <InfinitePostList
        query={feed}
        emptyText={emptyText}
        excludePostId={excludePostId}
        contextGroupId={postGroupId}
      />
    </>
  );
}

export default function Feed() {
  return (
    <PostList
      postGroupId={FEED_GROUP_ID}
      emptyText="Nothing in your feed yet."
    />
  );
}
