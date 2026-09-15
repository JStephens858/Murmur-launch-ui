"use client";

import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useFeed } from "@/lib/portal/feed";
import { PortalAuthError } from "@/lib/portal/graphql";

import PostCard, { PostCardSkeleton } from "./post-card";

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

/**
 * The home feed: pages of post ids from getPostsInGroup, each rendered
 * from the entity store. A sentinel below the list requests the next page
 * well before it scrolls into view, so the reader rarely sees a spinner.
 */
export default function Feed() {
  const feed = useFeed();
  const sentinel = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;

  const postIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const id of page.postIds) {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    return ids;
  }, [feed.data]);

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

  if (feed.status === "pending" || (feed.isError && !feed.data)) {
    if (feed.isError) {
      return <PortalError error={feed.error} retry={() => feed.refetch()} />;
    }
    return (
      <div aria-busy="true" aria-label="Loading feed">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (postIds.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8">
        Nothing in your feed yet.
      </p>
    );
  }

  return (
    <div>
      {postIds.map((id) => (
        <PostCard key={id} postId={id} />
      ))}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && <PostCardSkeleton />}
      {!hasNextPage && (
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          You&apos;re all caught up.
        </p>
      )}
      {feed.isError && (
        <PortalError error={feed.error} retry={() => feed.fetchNextPage()} />
      )}
    </div>
  );
}
