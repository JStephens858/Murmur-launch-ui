"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  EXPLORE_CHOICES,
  type ExploreChoice,
  useExplorePosts,
  useTrendingHashtags,
} from "@/lib/portal/explore";
import { useHashtag } from "@/lib/portal/store";
import type { PortalHashtag } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import { InfinitePostList } from "./feed";
import { exploreHashtagHref } from "./hashtag-chip";
import PortalPageHeader from "./page-header";

const EMPTY: Record<ExploreChoice, string> = {
  all: "Nothing to explore yet.",
  case: "No cases yet.",
  poll: "No polls yet.",
  tipsAndTricks: "No tips & tricks yet.",
  journal: "No journal posts yet.",
  question: "No questions yet.",
};

function TrendingChip({
  hashtagId,
  selected,
  onClick,
}: {
  hashtagId: string;
  selected: boolean;
  onClick: (tag: PortalHashtag) => void;
}) {
  const tag = useHashtag(hashtagId);
  if (!tag) return null;
  return (
    <button
      type="button"
      onClick={() => onClick(tag)}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium transition-colors",
        selected
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      #{tag.hashtag}
    </button>
  );
}

/**
 * The app's TrendingHashtagsView: the "Trending hashtags" heading over the
 * wrapped chips from getTrendingHashtags. Tapping one applies it as the
 * page's hashtag filter, which is what the app's push to the hashtag post
 * list amounts to. Hidden while loading or when there are none, as the app
 * hides it when the list is empty.
 */
function TrendingHashtags({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (tag: PortalHashtag) => void;
}) {
  const trending = useTrendingHashtags();
  if (!trending.data?.length) return null;
  return (
    <section
      aria-label="Trending hashtags"
      className="border-border/40 flex flex-col gap-2 border-b px-4 py-3"
    >
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Trending hashtags
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {trending.data.map((id) => (
          <TrendingChip
            key={id}
            hashtagId={id}
            selected={id === activeId}
            onClick={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The Explore tab: a chooser like the videos page's (All posts, Cases,
 * Polls, Tips & Tricks, Journal, Question) over one post list, with an optional hashtag chip
 * tacked on the end, over the app's trending hashtags strip. Tapping a tag
 * on a card or in the strip applies it. The backend's
 * hashtag list has no sections, so while a tag is active the list is
 * "everything with this tag" and the section choices are disabled.
 */
export default function PortalExplore() {
  const router = useRouter();
  const params = useSearchParams();
  // The URL is the source of truth for the tag filter: chips on the feed and
  // the post page link to /explore?hashtagId=…&hashtag=…, and tapping a tag
  // here writes the same address, so either way the page is shareable.
  const urlTagId = params.get("hashtagId");
  const urlTagName = params.get("hashtag");
  const tag = useMemo<PortalHashtag | null>(
    () =>
      urlTagId ? { hashtagId: urlTagId, hashtag: urlTagName ?? "" } : null,
    [urlTagId, urlTagName],
  );

  // The backend's hashtag list has no sections, so a tag forces "All posts";
  // the reader's own choice is kept for when the tag is cleared.
  const [chosen, setChosen] = useState<ExploreChoice>("all");
  const choice: ExploreChoice = tag ? "all" : chosen;
  const query = useExplorePosts(choice, tag?.hashtagId ?? null);

  const applyTag = (next: PortalHashtag | null) => {
    // replace, not push: one history entry per visit, not per toggle.
    router.replace(next ? exploreHashtagHref(next) : "/explore", {
      scroll: false,
    });
  };
  const toggleTag = (next: PortalHashtag) =>
    applyTag(next.hashtagId === tag?.hashtagId ? null : next);

  return (
    <>
      <PortalPageHeader title="Explore" />
      <div className="border-border/40 flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Post type"
        >
          {EXPLORE_CHOICES.map(({ value, label }) => {
            const disabled = tag != null && value !== "all";
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={choice === value}
                aria-disabled={disabled || undefined}
                title={
                  disabled ? "Not available with a hashtag filter" : undefined
                }
                onClick={() => {
                  if (!disabled) setChosen(value);
                }}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  choice === value
                    ? "glass-5 border-border/80 dark:border-border/35 dark:from-primary/25 dark:to-primary/10 text-foreground shadow-md"
                    : disabled
                      ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                      : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {tag && (
          <button
            type="button"
            onClick={() => applyTag(null)}
            aria-label={`Clear hashtag filter #${tag.hashtag}`}
            className="border-primary/50 bg-primary/15 text-foreground hover:bg-primary/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
          >
            #{tag.hashtag}
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <TrendingHashtags
        activeId={tag?.hashtagId ?? null}
        onSelect={toggleTag}
      />
      <InfinitePostList
        key={`${choice}:${tag?.hashtagId ?? ""}`}
        query={query}
        emptyText={tag ? `No posts tagged #${tag.hashtag} yet.` : EMPTY[choice]}
        onHashtagClick={toggleTag}
      />
    </>
  );
}
