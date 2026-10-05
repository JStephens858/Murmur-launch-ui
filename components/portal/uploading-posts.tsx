"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, X } from "lucide-react";

import {
  dismissUpload,
  retryUploads,
  type UploadingPost,
  useUploadingPosts,
} from "@/lib/portal/uploads";
import { cn } from "@/lib/utils";

/* Local object URLs; plain <img>. */
/* eslint-disable @next/next/no-img-element */

function UploadingCard({ post }: { post: UploadingPost }) {
  const client = useQueryClient();
  const pct = post.bytesTotal
    ? Math.round((post.bytesSent / post.bytesTotal) * 100)
    : 100;
  const status = {
    uploading: `Uploading… ${pct}%`,
    processing: "Processing…",
    slow: "Still processing. Your post will appear when it's ready.",
    failed: post.error ?? "Upload failed",
  }[post.status];

  return (
    <div
      role="status"
      className="border-border/40 flex items-center gap-3 border-b px-4 py-3"
    >
      <span className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg">
        {post.thumbUrl &&
          (post.thumbIsVideo ? (
            <video
              src={post.thumbUrl}
              muted
              preload="metadata"
              className="size-full object-cover"
            />
          ) : (
            <img
              src={post.thumbUrl}
              alt=""
              className="size-full object-cover"
            />
          ))}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-sm font-medium">
          {post.label || "Your post"}
        </span>
        <span
          className={cn(
            "text-xs",
            post.status === "failed"
              ? "text-destructive-foreground"
              : "text-muted-foreground",
          )}
        >
          {status}
        </span>
        {(post.status === "uploading" || post.status === "processing") && (
          <span className="bg-muted h-1 overflow-hidden rounded-full">
            <span
              className={cn(
                "bg-primary block h-full rounded-full transition-[width]",
                post.status === "processing" && "animate-pulse",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </div>
      {post.status === "failed" && (
        <button
          type="button"
          onClick={() => retryUploads(client, post.postId)}
          aria-label="Retry upload"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-full p-2"
        >
          <RotateCw className="size-4" />
        </button>
      )}
      {(post.status === "failed" || post.status === "slow") && (
        <button
          type="button"
          onClick={() => dismissUpload(post.postId)}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-full p-2"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Posts still on their way, above a list of posts (UploadingFilesView). */
export default function UploadingPosts({
  postGroupId,
}: {
  postGroupId: string;
}) {
  const posts = useUploadingPosts(postGroupId);
  if (!posts.length) return null;
  return (
    <div>
      {posts.map((p) => (
        <UploadingCard key={p.postId} post={p} />
      ))}
    </div>
  );
}
