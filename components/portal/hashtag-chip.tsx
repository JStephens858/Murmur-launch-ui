"use client";

import Link from "next/link";

import { useHashtag } from "@/lib/portal/store";
import type { PortalHashtag } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

/** Explore with this tag applied, as if it had been tapped on an Explore post. */
export function exploreHashtagHref(tag: PortalHashtag) {
  const params = new URLSearchParams({
    hashtagId: tag.hashtagId,
    hashtag: tag.hashtag,
  });
  return `/explore?${params}`;
}

/**
 * A hashtag on a post. Where the page can filter in place (Explore) it is a
 * button that hands the tag back; everywhere else it links to Explore with
 * the tag applied. Either way it's clickable, so it's drawn like a control:
 * bordered, with a hover state.
 */
export default function HashtagChip({
  hashtagId,
  onClick,
  className,
}: {
  hashtagId: string;
  onClick?: (tag: PortalHashtag) => void;
  className?: string;
}) {
  const tag = useHashtag(hashtagId);
  if (!tag) return null;
  const classes = cn(
    "border-accent-foreground/30 bg-accent text-accent-foreground hover:border-accent-foreground/60 hover:bg-primary/20 inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(tag)} className={classes}>
        #{tag.hashtag}
      </button>
    );
  }
  return (
    <Link
      href={exploreHashtagHref(tag)}
      className={classes}
      aria-label={`Explore posts tagged #${tag.hashtag}`}
    >
      #{tag.hashtag}
    </Link>
  );
}
