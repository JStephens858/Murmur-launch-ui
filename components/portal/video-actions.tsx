"use client";

import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { useLikePost } from "@/lib/portal/actions";
import { useFullPost } from "@/lib/portal/feed";
import { usePost } from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import { postDetailHref } from "./post-card";

/**
 * The signed-in extras under a video in the player: a like toggle and a
 * comment count, each just an icon and a number, and a Full Post button.
 * Comments are read and written on the post page, so the count links there. The post is hydrated through the
 * store, which also warms the post page for the Full Post click.
 */
export default function VideoActions({ postId }: { postId: string }) {
  const post = usePost(postId);
  const full = useFullPost(postId);
  const like = useLikePost();
  const liked = !!post?.likedByMe;
  const href = postDetailHref(postId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={liked}
        aria-label={liked ? "Unlike" : "Like"}
        disabled={!post || like.isPending}
        onClick={() => like.mutate({ postId, like: !liked })}
        className={cn(
          "gap-1.5 rounded-full tabular-nums",
          liked && "text-primary",
        )}
      >
        <Heart
          className="size-4"
          fill={liked ? "currentColor" : "none"}
          aria-hidden
        />
        {formatCount(post?.numLikes ?? 0)}
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-full tabular-nums"
      >
        <Link href={href} aria-label={`${post?.numComments ?? 0} comments`}>
          <MessageCircle className="size-4" aria-hidden />
          {formatCount(post?.numComments ?? 0)}
        </Link>
      </Button>
      <Button asChild variant="glow" size="sm" className="ml-auto rounded-full">
        <Link href={href}>Full Post</Link>
      </Button>
      {full.status === "error" && (
        <span className="text-destructive-foreground w-full text-xs">
          Couldn&apos;t load this post&apos;s details.
        </span>
      )}
    </div>
  );
}
