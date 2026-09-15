"use client";

import VideosBrowser from "@/components/sections/videos/browser";
import { usePortalVideos, usePortalVideosSource } from "@/lib/portal/videos";

import { PortalError } from "./feed";
import PortalPageHeader from "./page-header";
import { postDetailHref } from "./post-card";
import VideoActions from "./video-actions";

/**
 * The portal's Videos tab (/videos): the public library's browser fed by the signed-in
 * videos query, with the player gaining like, comment count and Full Post.
 * The player is state-only (nothing in the URL), so coming back from the
 * post lands on the plain videos page.
 */
export default function PortalVideos() {
  const source = usePortalVideosSource();
  const initial = usePortalVideos(source);

  return (
    <>
      <PortalPageHeader title="Videos" />
      <div className="px-4 py-4">
        {initial.status === "pending" && (
          <p className="text-muted-foreground" aria-busy="true">
            Loading videos…
          </p>
        )}
        {initial.status === "error" && (
          <PortalError error={initial.error} retry={() => initial.refetch()} />
        )}
        {initial.data && (
          <VideosBrowser
            initial={initial.data}
            source={source}
            postHref={(video) => postDetailHref(video.postId)}
            renderActions={(video) => <VideoActions postId={video.postId} />}
          />
        )}
      </div>
    </>
  );
}
