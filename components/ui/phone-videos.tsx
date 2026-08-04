"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIDEOS = [
  "/video1.mp4",
  "/video2.mp4",
  "/video3.mp4",
  "/video4.mp4",
  "/video5.mp4",
];

/**
 * A copy of the first clip is parked after the last one. The run always slides
 * the same direction; when it reaches that copy, the track snaps back to the
 * real first slide with the transition switched off. Both show identical
 * pixels, so the reset is invisible — where wrapping straight from the last
 * slide to the first would animate the whole strip backwards.
 */
const SLIDES = [...VIDEOS, VIDEOS[0]];
const CLONE = VIDEOS.length;

/** Must match the transition duration below. */
const SLIDE_MS = 500;
/** Each clip runs ~5s; the backstop only fires if playback never started. */
const CLIP_BACKSTOP_MS = 5800;

export function PhoneVideos({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [instant, setInstant] = useState(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const next = useCallback(() => setIndex((current) => current + 1), []);

  useEffect(() => {
    videos.current.forEach((video, i) => {
      if (video && i !== index) video.pause();
    });

    if (index === CLONE) {
      // Left paused on its first frame: it only has to look right for the
      // half second it takes to slide in, then the real slide takes over.
      const reset = setTimeout(() => {
        setInstant(true);
        setIndex(0);
      }, SLIDE_MS);
      return () => clearTimeout(reset);
    }

    const active = videos.current[index];
    if (active) {
      active.currentTime = 0;
      // Muted autoplay is normally allowed, but a rejected promise here is
      // unhandled otherwise — and the run still advances either way.
      void active.play().catch(() => {});
    }

    // Without this, a browser that refuses to play would never fire `ended`
    // and the run would sit on one clip forever.
    const backstop = setTimeout(next, CLIP_BACKSTOP_MS);
    return () => clearTimeout(backstop);
  }, [index, next]);

  // Restore the transition only after the snapped-back position has painted,
  // otherwise the browser animates the snap itself.
  useEffect(() => {
    if (!instant) return;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setInstant(false)),
    );
    return () => cancelAnimationFrame(frame);
  }, [instant]);

  return (
    <div className={className}>
      <div
        className={
          instant
            ? "flex h-full w-full"
            : "flex h-full w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
        }
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {SLIDES.map((src, i) => (
          <video
            key={`${src}-${i}`}
            ref={(el) => {
              videos.current[i] = el;
            }}
            src={src}
            muted
            playsInline
            // The clone shares the first clip's URL, so its "auto" costs
            // nothing beyond what slide 0 already fetched.
            preload={i === 0 || i === CLONE ? "auto" : "metadata"}
            onEnded={next}
            aria-hidden
            className="h-full w-full shrink-0 object-cover"
          />
        ))}
      </div>
    </div>
  );
}
