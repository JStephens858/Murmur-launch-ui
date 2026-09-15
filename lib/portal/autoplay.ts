"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Plays whichever inline video is most on screen and pauses the rest.
 *
 * One coordinator per page: every registered <video> shares an
 * IntersectionObserver reporting how much of it is visible; on any change
 * the most-visible one (at least half showing) becomes the active video
 * and is played, everything else is paused. A video the reader paused by
 * hand stays paused until they play it again, and a video they started
 * themselves pauses the others. Autoplay is muted, which is what browsers
 * allow without a gesture; once the reader unmutes one, later autoplays try
 * unmuted first and fall back to muted if the browser refuses.
 */

const MIN_VISIBLE = 0.5;
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

interface Entry {
  ratio: number;
  /** Visible area in px², to break ties between two half-visible videos. */
  area: number;
  userPaused: boolean;
  cleanup: () => void;
}

const videos = new Map<HTMLVideoElement, Entry>();
let observer: IntersectionObserver | null = null;
let active: HTMLVideoElement | null = null;
let preferUnmuted = false;
/** Set while the coordinator itself calls play()/pause(), so the element's
 *  own events can tell our changes from the reader's. */
let coordinating = false;

function ours(fn: () => void) {
  coordinating = true;
  try {
    fn();
  } finally {
    coordinating = false;
  }
}

function pause(video: HTMLVideoElement) {
  if (!video.paused) ours(() => video.pause());
}

async function play(video: HTMLVideoElement) {
  if (!video.paused) return;
  video.muted = !preferUnmuted;
  try {
    await video.play();
  } catch {
    if (!video.muted) {
      video.muted = true;
      try {
        await video.play();
      } catch {
        // Autoplay refused outright; the controls are still there.
      }
    }
  }
}

function reconcile() {
  let best: HTMLVideoElement | null = null;
  let bestEntry: Entry | null = null;
  for (const [video, entry] of videos) {
    if (entry.ratio < MIN_VISIBLE || entry.userPaused) continue;
    if (
      !bestEntry ||
      entry.ratio > bestEntry.ratio ||
      (entry.ratio === bestEntry.ratio && entry.area > bestEntry.area)
    ) {
      best = video;
      bestEntry = entry;
    }
  }
  if (typeof document !== "undefined" && document.hidden) best = null;
  active = best;
  for (const video of videos.keys()) {
    if (video === best) void play(video);
    else pause(video);
  }
}

function ensureObserver() {
  if (observer || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const entry = videos.get(e.target as HTMLVideoElement);
        if (!entry) continue;
        entry.ratio = e.intersectionRatio;
        entry.area = e.intersectionRect.width * e.intersectionRect.height;
      }
      reconcile();
    },
    { threshold: THRESHOLDS },
  );
  document.addEventListener("visibilitychange", reconcile);
}

function register(video: HTMLVideoElement) {
  ensureObserver();
  const onPause = () => {
    // A pause the reader didn't ask for: ours, the end of the clip, or the
    // browser giving up on a source that never produced a frame (a failed
    // play() fires pause too). Only a pause with decoded data behind it is
    // treated as the reader's decision.
    if (
      coordinating ||
      video.ended ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }
    const entry = videos.get(video);
    if (entry) entry.userPaused = true;
  };
  const onPlay = () => {
    if (coordinating) return;
    const entry = videos.get(video);
    if (entry) entry.userPaused = false;
    // The reader chose this one; nothing else should talk over it.
    active = video;
    for (const other of videos.keys()) if (other !== video) pause(other);
  };
  const onVolume = () => {
    if (!coordinating) preferUnmuted = !video.muted;
  };
  video.addEventListener("pause", onPause);
  video.addEventListener("play", onPlay);
  video.addEventListener("volumechange", onVolume);
  observer?.observe(video);
  videos.set(video, {
    ratio: 0,
    area: 0,
    userPaused: false,
    cleanup: () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("volumechange", onVolume);
      observer?.unobserve(video);
    },
  });
}

function unregister(video: HTMLVideoElement) {
  videos.get(video)?.cleanup();
  videos.delete(video);
  if (active === video) active = null;
  if (videos.size === 0 && observer) {
    observer.disconnect();
    observer = null;
    document.removeEventListener("visibilitychange", reconcile);
  } else {
    reconcile();
  }
}

/** Ref callback for a <video>; attach it and the coordinator takes over. */
export function useAutoplayVideo() {
  const current = useRef<HTMLVideoElement | null>(null);
  useEffect(
    () => () => {
      if (current.current) unregister(current.current);
      current.current = null;
    },
    [],
  );
  return useCallback((video: HTMLVideoElement | null) => {
    if (current.current && current.current !== video)
      unregister(current.current);
    current.current = video;
    if (video) register(video);
  }, []);
}
