"use client";

import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import Footer from "@/components/sections/footer/default";
import Navbar from "@/components/sections/navbar/default";
import { Badge } from "@/components/ui/badge";
import { VideoCard } from "@/components/ui/video-card";
import { VideoPlayer } from "@/components/ui/video-player";
import {
  formatDuration,
  formatPublishedAt,
  longFormVideos,
  shortFormVideos,
  videos,
  type Video,
} from "@/lib/videos";

function CarouselRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Video[];
  onSelect: (video: Video) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const scrollByPage = (direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * scroller.clientWidth * 0.9,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Scroll ${title} back`}
            onClick={() => scrollByPage(-1)}
            className="border-border hover:bg-muted flex size-9 items-center justify-center rounded-full border transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} forward`}
            onClick={() => scrollByPage(1)}
            className="border-border hover:bg-muted flex size-9 items-center justify-center rounded-full border transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onClick={() => onSelect(video)}
            className={
              video.orientation === "PORTRAIT"
                ? "w-40 shrink-0 snap-start sm:w-44"
                : "w-64 shrink-0 snap-start sm:w-72"
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function Videos1() {
  const [selected, setSelected] = React.useState<Video>(videos[0]);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const theaterRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (video: Video) => {
    setSelected(video);
    setIsPlaying(true);
    theaterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="bg-background text-foreground min-h-screen w-full">
      <Navbar />
      <section className="max-w-container mx-auto flex flex-col gap-12 px-4 py-12 sm:gap-16">
        {/* Theater */}
        <div ref={theaterRef} className="flex scroll-mt-24 flex-col gap-4">
          {/* The theater stays 16:9; portrait videos and posters letterbox inside it. */}
          <div className="border-border/60 relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-xl">
            {isPlaying ? (
              <VideoPlayer
                key={selected.id}
                src={selected.streamUrl}
                poster={selected.previewImageUrl}
                autoPlay
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="group relative h-full w-full"
                aria-label={`Play ${selected.title}`}
              >
                <Image
                  src={selected.previewImageUrl}
                  alt={selected.title}
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className={
                    selected.orientation === "PORTRAIT"
                      ? "object-contain"
                      : "object-cover"
                  }
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                  <span className="bg-brand flex size-20 items-center justify-center rounded-full text-white shadow-2xl transition-transform group-hover:scale-110">
                    <Play className="ml-1 size-9" />
                  </span>
                </span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {selected.title}
              </h1>
              <Badge variant="outline">
                {selected.kind === "LONG_FORM" ? "Long-form" : "Short"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {selected.specialty} · {formatDuration(selected.durationSeconds)}{" "}
              · {formatPublishedAt(selected.publishedAt)}
            </p>
            <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">
              {selected.description}
            </p>
          </div>
        </div>

        {/* Carousel rows */}
        <CarouselRow
          title="Long-form"
          items={longFormVideos}
          onSelect={handleSelect}
        />
        <CarouselRow
          title="Shorts"
          items={shortFormVideos}
          onSelect={handleSelect}
        />
      </section>
      <Footer />
    </main>
  );
}
