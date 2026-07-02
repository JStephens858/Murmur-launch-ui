"use client";

import Hls from "hls.js";
import * as React from "react";

import { cn } from "@/lib/utils";

interface VideoPlayerProps extends React.ComponentProps<"video"> {
  src: string;
}

function VideoPlayer({
  src,
  className,
  autoPlay,
  ...props
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari plays HLS natively; everywhere else needs hls.js MSE playback.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      if (autoPlay) video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      if (autoPlay) {
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }
      return () => hls.destroy();
    }

    video.src = src;
  }, [src, autoPlay]);

  return (
    <video
      ref={videoRef}
      data-slot="video-player"
      controls
      playsInline
      className={cn("h-full w-full bg-black", className)}
      {...props}
    />
  );
}

export { VideoPlayer };
