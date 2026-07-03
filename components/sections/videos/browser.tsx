"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import * as React from "react";

import { VideoPlayer } from "@/components/ui/video-player";
import { formatDurationMs, formatVideoDate, formatViews } from "@/lib/format";
import { type SiteVideo } from "@/lib/murmur-api";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "LONG_FORM" | "SHORT_FORM";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All videos" },
  { value: "LONG_FORM", label: "Long-form" },
  { value: "SHORT_FORM", label: "Shorts" },
];

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
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground line-clamp-2 text-sm leading-snug font-semibold">
          {video.title}
        </h3>
        {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
      </div>
    </button>
  );
}

export default function VideosBrowser({
  longVideos,
  shortVideos,
}: {
  longVideos: SiteVideo[];
  shortVideos: SiteVideo[];
}) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [active, setActive] = React.useState<SiteVideo | null>(null);

  const showLong = filter !== "SHORT_FORM" && longVideos.length > 0;
  const showShort = filter !== "LONG_FORM" && shortVideos.length > 0;

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
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showLong && (
        <div className="flex flex-col gap-4">
          {filter === "ALL" && (
            <h2 className="text-xl font-semibold">Long-form</h2>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {longVideos.map((video) => (
              <VideoPostCard
                key={video.postId}
                video={video}
                onClick={() => setActive(video)}
              />
            ))}
          </div>
        </div>
      )}

      {showShort && (
        <div className="flex flex-col gap-4">
          {filter === "ALL" && <h2 className="text-xl font-semibold">Shorts</h2>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {shortVideos.map((video) => (
              <VideoPostCard
                key={video.postId}
                video={video}
                onClick={() => setActive(video)}
              />
            ))}
          </div>
        </div>
      )}

      {!showLong && !showShort && (
        <p className="text-muted-foreground">No videos yet — check back soon.</p>
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
