"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRightIcon, Play, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/ui/video-player";
import { track } from "@/lib/analytics";
import { formatDurationMs, formatVideoDate, formatViews } from "@/lib/format";
import {
  type PublicVideosPage,
  type SiteVideo,
  type VideoHashtag,
} from "@/lib/murmur-api";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "LONG_FORM" | "SHORT_FORM";
type VideoType = "long" | "short";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All videos" },
  { value: "LONG_FORM", label: "Long-form" },
  { value: "SHORT_FORM", label: "Shorts" },
];

const PAGE_SIZE = 24;

/**
 * In the "All videos" view each group shows two grid rows at every
 * breakpoint. Long grid is 1/2/3/4 columns, shorts 2/3/5/6 — so tiles
 * beyond 2×cols hide per breakpoint.
 */
function longCapClass(index: number): string {
  if (index < 2) return "";
  if (index < 4) return "hidden sm:block";
  if (index < 6) return "hidden lg:block";
  if (index < 8) return "hidden xl:block";
  return "hidden";
}

function shortCapClass(index: number): string {
  if (index < 4) return "";
  if (index < 6) return "hidden sm:block";
  if (index < 10) return "hidden lg:block";
  if (index < 12) return "hidden xl:block";
  return "hidden";
}

/**
 * "View more" only makes sense when more videos exist than the capped grid
 * shows: further API pages, or loaded tiles hidden by the cap. The caps are
 * per-breakpoint (mirroring longCapClass/shortCapClass), so without further
 * pages the button hides at breakpoints where the grid already shows
 * everything. null = never more, don't render.
 */
function viewMoreClass(
  count: number,
  hasMore: boolean,
  [base, sm, lg, xl]: [number, number, number, number],
): string | null {
  if (hasMore) return "";
  if (count > xl) return "";
  if (count > lg) return "xl:hidden";
  if (count > sm) return "lg:hidden";
  if (count > base) return "sm:hidden";
  return null;
}

const LONG_CAPS: [number, number, number, number] = [2, 4, 6, 8];
const SHORT_CAPS: [number, number, number, number] = [4, 6, 10, 12];

/** Hashtag chip; clicking filters the browser to videos with that tag. */
function HashtagChip({
  tag,
  selected,
  onClick,
}: {
  tag: VideoHashtag;
  selected: boolean;
  onClick: (tag: VideoHashtag) => void;
}) {
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

function HashtagRow({
  tags,
  max,
  selectedTagId,
  onTagClick,
}: {
  tags: VideoHashtag[];
  max?: number;
  selectedTagId?: string;
  onTagClick: (tag: VideoHashtag) => void;
}) {
  if (tags.length === 0) return null;
  const visible = max ? tags.slice(0, max) : tags;
  const overflow = tags.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <HashtagChip
          key={tag.hashtagId}
          tag={tag}
          selected={tag.hashtagId === selectedTagId}
          onClick={onTagClick}
        />
      ))}
      {overflow > 0 && (
        <span className="text-muted-foreground text-xs">+{overflow}</span>
      )}
    </div>
  );
}

function VideoPostCard({
  video,
  onClick,
  selectedTagId,
  onTagClick,
}: {
  video: SiteVideo;
  onClick: () => void;
  selectedTagId?: string;
  onTagClick: (tag: VideoHashtag) => void;
}) {
  const meta = [
    video.authorName,
    video.publishedDate ? formatVideoDate(video.publishedDate) : null,
    formatViews(video.views),
  ]
    .filter(Boolean)
    .join(" · ");

  // The tag row sits outside the card button — the chips are buttons
  // themselves and can't nest inside it.
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col gap-3 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div
          className={cn(
            "border-border/60 relative w-full overflow-hidden rounded-xl border bg-black",
            video.orientation === "PORTRAIT" ? "aspect-[9/16]" : "aspect-video",
          )}
        >
          {video.previewImageUrl && (
            // Preview hosts vary (CloudFront resizer or raw S3), so plain <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.previewImageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/30">
            <span className="bg-background/90 text-foreground flex size-12 items-center justify-center rounded-full opacity-0 shadow-md transition-opacity duration-300 group-hover:opacity-100">
              <Play className="ml-0.5 size-5" />
            </span>
          </div>
          {video.durationMs != null && video.durationMs > 0 && (
            <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {formatDurationMs(video.durationMs)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-foreground line-clamp-2 text-sm leading-snug font-semibold">
            {video.title}
          </h3>
          {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        </div>
      </button>
      <HashtagRow
        tags={video.hashtags}
        max={3}
        selectedTagId={selectedTagId}
        onTagClick={onTagClick}
      />
    </div>
  );
}

export default function VideosBrowser({
  initial,
}: {
  initial: PublicVideosPage;
}) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [active, setActive] = React.useState<SiteVideo | null>(null);
  const [activeTag, setActiveTag] = React.useState<VideoHashtag | null>(null);
  const [tagLoading, setTagLoading] = React.useState(false);
  const [longs, setLongs] = React.useState(initial.longVideos);
  const [shorts, setShorts] = React.useState(initial.shortVideos);
  const [hasMore, setHasMore] = React.useState({
    long: initial.longHasMore,
    short: initial.shortHasMore,
  });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const cursors = React.useRef({
    long: initial.lastLongPostId,
    short: initial.lastShortPostId,
  });
  const loadingRef = React.useRef(false);
  // Bumped whenever the tag filter changes, so in-flight page loads for the
  // previous tag get discarded instead of appended.
  const tagGeneration = React.useRef(0);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const openVideo = React.useCallback((video: SiteVideo) => {
    setActive(video);
    track("Video Opened", {
      post_id: video.postId,
      title: video.title,
      kind: video.kind,
      author: video.authorUsername ?? video.authorName ?? undefined,
      duration_ms: video.durationMs ?? undefined,
    });
  }, []);

  // Set or clear the tag filter: reload both lists for the tag, or restore
  // the unfiltered server-rendered data.
  const applyTag = React.useCallback(
    (tag: VideoHashtag | null) => {
      tagGeneration.current += 1;
      setActiveTag(tag);
      if (!tag) {
        setTagLoading(false);
        setLongs(initial.longVideos);
        setShorts(initial.shortVideos);
        cursors.current = {
          long: initial.lastLongPostId,
          short: initial.lastShortPostId,
        };
        setHasMore({ long: initial.longHasMore, short: initial.shortHasMore });
        return;
      }
      const generation = tagGeneration.current;
      setTagLoading(true);
      setLongs([]);
      setShorts([]);
      cursors.current = { long: null, short: null };
      setHasMore({ long: false, short: false });
      (async () => {
        try {
          const query = new URLSearchParams({
            type: "all",
            count: String(PAGE_SIZE),
            hashtagId: tag.hashtagId,
          });
          const res = await fetch(`/api/videos?${query}`);
          if (!res.ok) throw new Error(`videos api ${res.status}`);
          const page: PublicVideosPage = await res.json();
          if (generation !== tagGeneration.current) return;
          setLongs(page.longVideos);
          setShorts(page.shortVideos);
          cursors.current = {
            long: page.lastLongPostId,
            short: page.lastShortPostId,
          };
          setHasMore({ long: page.longHasMore, short: page.shortHasMore });
        } catch {
          // Leave the lists empty; the empty state covers it.
        } finally {
          if (generation === tagGeneration.current) setTagLoading(false);
        }
      })();
    },
    [initial],
  );

  /** Toggle the hashtag filter; also closes the player if open. */
  const selectTag = React.useCallback(
    (tag: VideoHashtag) => {
      setActive(null);
      setFilter("ALL");
      if (activeTag?.hashtagId === tag.hashtagId) {
        applyTag(null);
        return;
      }
      track("Hashtag Selected", {
        hashtag_id: tag.hashtagId,
        hashtag: tag.hashtag,
      });
      applyTag(tag);
    },
    [activeTag, applyTag],
  );

  const loadMore = React.useCallback(async (type: VideoType) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const generation = tagGeneration.current;
    try {
      const cursor = cursors.current[type];
      const query = new URLSearchParams({
        type,
        count: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
        ...(activeTag ? { hashtagId: activeTag.hashtagId } : {}),
      });
      const res = await fetch(`/api/videos?${query}`);
      if (!res.ok) throw new Error(`videos api ${res.status}`);
      const page: PublicVideosPage = await res.json();
      if (generation !== tagGeneration.current) return;
      if (type === "long") {
        cursors.current.long = page.lastLongPostId ?? cursors.current.long;
        setLongs((prev) => {
          const seen = new Set(prev.map((v) => v.postId));
          return [...prev, ...page.longVideos.filter((v) => !seen.has(v.postId))];
        });
        setHasMore((prev) => ({ ...prev, long: page.longHasMore }));
      } else {
        cursors.current.short = page.lastShortPostId ?? cursors.current.short;
        setShorts((prev) => {
          const seen = new Set(prev.map((v) => v.postId));
          return [
            ...prev,
            ...page.shortVideos.filter((v) => !seen.has(v.postId)),
          ];
        });
        setHasMore((prev) => ({ ...prev, short: page.shortHasMore }));
      }
    } catch {
      // Stop asking on failure; the user can re-trigger by re-filtering.
      if (generation === tagGeneration.current) {
        setHasMore((prev) =>
          type === "long"
            ? { ...prev, long: false }
            : { ...prev, short: false },
        );
      }
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [activeTag]);

  // Infinite scroll: only in a single-type view.
  const activeType: VideoType | null =
    filter === "LONG_FORM" ? "long" : filter === "SHORT_FORM" ? "short" : null;
  const activeHasMore = activeType ? hasMore[activeType] : false;

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !activeType || !activeHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore(activeType);
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeType, activeHasMore, loadMore]);

  const showLong = filter !== "SHORT_FORM" && longs.length > 0;
  const showShort = filter !== "LONG_FORM" && shorts.length > 0;
  const capped = filter === "ALL";
  const longViewMore = viewMoreClass(longs.length, hasMore.long, LONG_CAPS);
  const shortViewMore = viewMoreClass(shorts.length, hasMore.short, SHORT_CAPS);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="tablist" aria-label="Video type">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                filter === value
                  ? "glass-5 border-border/80 dark:border-border/35 dark:from-primary/25 dark:to-primary/10 text-foreground shadow-md"
                  : "border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTag && (
          <button
            type="button"
            onClick={() => applyTag(null)}
            aria-label={`Clear hashtag filter #${activeTag.hashtag}`}
            className="border-primary/50 bg-primary/15 text-foreground hover:bg-primary/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
          >
            #{activeTag.hashtag}
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showLong && (
        <div className="flex flex-col gap-4">
          {capped && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Long-form</h2>
              {longViewMore !== null && (
                <Button
                  variant="glow"
                  size="sm"
                  className={longViewMore || undefined}
                  onClick={() => setFilter("LONG_FORM")}
                >
                  View more
                  <ArrowRightIcon className="size-4" />
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {longs.map((video, index) => (
              <div
                key={video.postId}
                className={capped ? longCapClass(index) : undefined}
              >
                <VideoPostCard
                  video={video}
                  onClick={() => openVideo(video)}
                  selectedTagId={activeTag?.hashtagId}
                  onTagClick={selectTag}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {showShort && (
        <div className="flex flex-col gap-4">
          {capped && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Shorts</h2>
              {shortViewMore !== null && (
                <Button
                  variant="glow"
                  size="sm"
                  className={shortViewMore || undefined}
                  onClick={() => setFilter("SHORT_FORM")}
                >
                  View more
                  <ArrowRightIcon className="size-4" />
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {shorts.map((video, index) => (
              <div
                key={video.postId}
                className={capped ? shortCapClass(index) : undefined}
              >
                <VideoPostCard
                  video={video}
                  onClick={() => openVideo(video)}
                  selectedTagId={activeTag?.hashtagId}
                  onTagClick={selectTag}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showLong && !showShort && (
        <p className="text-muted-foreground">
          {tagLoading
            ? "Loading videos…"
            : activeTag
              ? `No videos tagged #${activeTag.hashtag} yet.`
              : "No videos yet — check back soon."}
        </p>
      )}

      {activeType && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && (
            <p className="text-muted-foreground text-sm">Loading more…</p>
          )}
          {!activeHasMore && !loadingMore && (
            <p className="text-muted-foreground text-sm">
              That&apos;s all for now.
            </p>
          )}
        </div>
      )}

      <Dialog.Root
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content
            className={cn(
              "bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl focus:outline-none",
              active?.orientation === "PORTRAIT"
                ? "w-[min(96vw,26rem)]"
                : "w-[min(96vw,64rem)]",
            )}
          >
            {active && (
              <div className="flex max-h-[92vh] flex-col overflow-y-auto">
                <div
                  className={cn(
                    "w-full shrink-0",
                    active.orientation === "PORTRAIT"
                      ? "aspect-[9/16] max-h-[70vh]"
                      : "aspect-video",
                  )}
                >
                  <VideoPlayer
                    key={active.postId}
                    src={active.streamUrl}
                    poster={active.previewImageUrl ?? undefined}
                    autoPlay
                  />
                </div>
                <div className="flex flex-col gap-2 p-4 sm:p-6">
                  <Dialog.Title className="text-lg font-semibold sm:text-xl">
                    {active.title}
                  </Dialog.Title>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    {[
                      active.authorName,
                      active.publishedDate
                        ? formatVideoDate(active.publishedDate)
                        : null,
                      formatViews(active.views),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <HashtagRow
                    tags={active.hashtags}
                    selectedTagId={activeTag?.hashtagId}
                    onTagClick={selectTag}
                  />
                  {active.description && (
                    <Dialog.Description className="text-muted-foreground text-sm whitespace-pre-line">
                      {active.description}
                    </Dialog.Description>
                  )}
                </div>
              </div>
            )}
            <Dialog.Close
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
