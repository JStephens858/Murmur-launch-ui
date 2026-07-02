"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { VideoCard } from "@/components/ui/video-card";
import { VideoPlayer } from "@/components/ui/video-player";
import {
  formatDuration,
  formatPublishedAt,
  longFormVideos,
  shortFormVideos,
  type Video,
  type VideoKind,
} from "@/lib/videos";
import { cn } from "@/lib/utils";

type Filter = "ALL" | VideoKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All videos" },
  { value: "LONG_FORM", label: "Long-form" },
  { value: "SHORT_FORM", label: "Shorts" },
];

export default function Videos2() {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [active, setActive] = React.useState<Video | null>(null);

  const visible =
    filter === "ALL" ? videos : videos.filter((v) => v.kind === filter);

  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col gap-8 px-4 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold sm:text-4xl">Videos</h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Long-form conversations with physicians and short clips from the
            MurmurMD community. Watch them here, or in the app.
          </p>
        </div>

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

        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              showKind={filter === "ALL"}
              onClick={() => setActive(video)}
            />
          ))}
        </div>
      </section>
      <Footer />

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
                    key={active.id}
                    src={active.streamUrl}
                    poster={active.previewImageUrl}
                    autoPlay
                  />
                </div>
                <div className="flex flex-col gap-2 p-4 sm:p-6">
                  <Dialog.Title className="text-lg font-semibold sm:text-xl">
                    {active.title}
                  </Dialog.Title>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    {active.specialty} ·{" "}
                    {formatDuration(active.durationSeconds)} ·{" "}
                    {formatPublishedAt(active.publishedAt)}
                  </p>
                  <Dialog.Description className="text-muted-foreground text-sm">
                    {active.description}
                  </Dialog.Description>
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
    </main>
  );
}
