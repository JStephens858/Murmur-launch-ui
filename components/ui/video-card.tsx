"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { formatDuration, type Video } from "@/lib/videos";
import { cn } from "@/lib/utils";

import { Badge } from "./badge";

interface VideoCardProps extends React.ComponentProps<"button"> {
  video: Video;
  showKind?: boolean;
}

function VideoCard({ video, showKind, className, ...props }: VideoCardProps) {
  return (
    <button
      type="button"
      data-slot="video-card"
      className={cn(
        "group flex w-full flex-col gap-3 text-left",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "border-border/60 relative w-full overflow-hidden rounded-xl border",
          video.orientation === "PORTRAIT" ? "aspect-[9/16]" : "aspect-video",
        )}
      >
        <Image
          src={video.previewImageUrl}
          alt={video.title}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/30">
          <span className="bg-background/90 text-foreground flex size-12 items-center justify-center rounded-full opacity-0 shadow-md transition-opacity duration-300 group-hover:opacity-100">
            <Play className="ml-0.5 size-5" />
          </span>
        </div>
        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(video.durationSeconds)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <h3 className="text-foreground line-clamp-2 flex-1 text-sm leading-snug font-semibold">
            {video.title}
          </h3>
          {showKind && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {video.kind === "LONG_FORM" ? "Long-form" : "Short"}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{video.specialty}</p>
      </div>
    </button>
  );
}

export { VideoCard };
