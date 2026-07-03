"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRightIcon, Play, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/ui/video-player";
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
 * Hashtag chip, drawn as a small disabled button. Not a real <button>:
 * cards are buttons themselves, and tag search isn't built yet — these
 * become links once tag-filtered browsing exists.
 */
function HashtagChip({ tag }: { tag: VideoHashtag }) {
  return (
    <span
      aria-disabled="true"
      className="border-border/60 bg-card/60 text-muted-foreground inline-flex cursor-default items-center rounded-full border px-2 py-0.5 text-xs font-medium opacity-70"
    >
      #{tag.hashtag}
    </span>
  );
}

function HashtagRow({
  tags,
  max,
}: {
  tags: VideoHashtag[];
  max?: number;
}) {
  if (tags.length === 0) return null;
  const visible = max ? tags.slice(0, max) : tags;
  const overflow = tags.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((tag) => (
        <HashtagChip key={tag.hashtagId} tag={tag} />
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
}: {
  video: SiteVideo;
  onClick: () => void;
}) {
  const meta = [
    video.authorName,
    video.publishedDate ? formatVideoDate(video.publishedDate) : null,
    formatViews(video.views),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
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
        <HashtagRow tags={video.hashtags} max={3} />
      </div>
    </button>
  );
}

export default function VideosBrowser({
  initial,
}: {
  initial: PublicVideosPage;
}) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [active, setActive] = React.useState<SiteVideo | null>(null);
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
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const loadMore = React.useCallback(async (type: VideoType) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const cursor = cursors.current[type];
      const query = new URLSearchParams({
        type,
        count: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      });
      const res = await fetch(`/api/videos?${query}`);
      if (!res.ok) throw new Error(`videos api ${res.status}`);
      const page: PublicVideosPage = await res.json();
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
      setHasMore((prev) =>
        type === "long" ? { ...prev, long: false } : { ...prev, short: false },
      );
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, []);

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

  return (
    <>
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

      {showLong && (
        <div className="flex flex-col gap-4">
          {capped && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Long-form</h2>
              <Button
                variant="glow"
                size="sm"
                onClick={() => setFilter("LONG_FORM")}
              >
                View more
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {longs.map((video, index) => (
              <div
                key={video.postId}
                className={capped ? longCapClass(index) : undefined}
              >
                <VideoPostCard video={video} onClick={() => setActive(video)} />
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
              <Button
                variant="glow"
                size="sm"
                onClick={() => setFilter("SHORT_FORM")}
              >
                View more
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {shorts.map((video, index) => (
              <div
                key={video.postId}
                className={capped ? shortCapClass(index) : undefined}
              >
                <VideoPostCard video={video} onClick={() => setActive(video)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showLong && !showShort && (
        <p className="text-muted-foreground">No videos yet — check back soon.</p>
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
                  <HashtagRow tags={active.hashtags} />
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
