"use client";

import { X } from "lucide-react";
import { useState } from "react";

import {
  EXPLORE_CHOICES,
  type ExploreChoice,
  useExplorePosts,
} from "@/lib/portal/explore";
import type { PortalHashtag } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import { InfinitePostList } from "./feed";
import PortalPageHeader from "./page-header";

const EMPTY: Record<ExploreChoice, string> = {
  all: "Nothing to explore yet.",
  case: "No cases yet.",
  poll: "No polls yet.",
  tipsAndTricks: "No tips & tricks yet.",
};

/**
 * The Explore tab: a chooser like the videos page's (All posts, Cases,
 * Polls, Tips & Tricks) over one post list, with an optional hashtag chip
 * tacked on the end. Tapping a tag on a card applies it. The backend's
 * hashtag list has no sections, so while a tag is active the list is
 * "everything with this tag" and the section choices are disabled.
 */
export default function PortalExplore() {
  const [choice, setChoice] = useState<ExploreChoice>("all");
  const [tag, setTag] = useState<PortalHashtag | null>(null);
  const query = useExplorePosts(choice, tag?.hashtagId ?? null);

  const applyTag = (next: PortalHashtag | null) => {
    setTag(next);
    if (next) setChoice("all");
  };

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
                  if (!disabled) setChoice(value);
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
      <InfinitePostList
        key={`${choice}:${tag?.hashtagId ?? ""}`}
        query={query}
        emptyText={tag ? `No posts tagged #${tag.hashtag} yet.` : EMPTY[choice]}
        onHashtagClick={(next) =>
          applyTag(next.hashtagId === tag?.hashtagId ? null : next)
        }
      />
    </>
  );
}
