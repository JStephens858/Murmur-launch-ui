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
  ref,
  ...props
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  // Share the element with a caller's ref (callback or object) as well.
  const setRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

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
      ref={setRef}
      data-slot="video-player"
      controls
      playsInline
      className={cn("h-full w-full bg-black", className)}
      {...props}
    />
  );
}

export { VideoPlayer };
