"use client";

import { FileIcon } from "lucide-react";
import Link from "next/link";

import { VideoPlayer } from "@/components/ui/video-player";
import { formatDurationMs } from "@/lib/format";
import { useAutoplayVideo } from "@/lib/portal/autoplay";
import { canEditPost, canQuotePost } from "@/lib/portal/compose";
import { useCurrentUser } from "@/lib/portal/current-user";
import { useFullPost } from "@/lib/portal/feed";
import { usePostGroupLoaded } from "@/lib/portal/groups";
import {
  useMediaElement,
  useMediaElements,
  usePost,
  usePosts,
  useUser,
} from "@/lib/portal/store";
import type { PortalMediaElement, PortalPost } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import { PortalError } from "./feed";
import HashtagChip from "./hashtag-chip";
import { SquareAndPencilIcon, TextQuoteIcon } from "./icons";
import { composeHref } from "./nav";
import PollElement from "./poll";
import { LikeCounter, PostCardSkeleton, PostCounters } from "./post-card";

/* User media hosts are unbounded; plain <img>, see avatar.tsx. */
/* eslint-disable @next/next/no-img-element */

/** A post video: plays when it is the most visible one on the page. */
function InlineVideo({ element }: { element: PortalMediaElement }) {
  const autoplayRef = useAutoplayVideo();
  return (
    <VideoPlayer
      ref={autoplayRef}
      src={element.streamUrl ?? ""}
      poster={element.mediaPreviewImageUrl ?? undefined}
      controls
      muted
      loop={false}
      preload="metadata"
      className="max-h-[75vh] w-full"
    />
  );
}

function Attachment({ element }: { element: PortalMediaElement }) {
  if (!element.attachmentDestinationUrl) return null;
  return (
    <a
      href={element.attachmentDestinationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border/60 hover:bg-foreground/[0.03] flex overflow-hidden rounded-xl border"
    >
      {element.attachmentImage && (
        <img
          src={element.attachmentImage}
          alt=""
          className="w-28 shrink-0 object-cover"
        />
      )}
      <span className="flex min-w-0 flex-col gap-1 p-3 text-sm">
        <span className="font-medium">
          {element.attachmentTitle ?? element.attachmentDestinationUrl}
        </span>
        {element.attachmentDescription && (
          <span className="text-muted-foreground line-clamp-2">
            {element.attachmentDescription}
          </span>
        )}
      </span>
    </a>
  );
}

function MediaElement({ id, className }: { id: string; className?: string }) {
  const element = useMediaElement(id);
  if (!element) return null;

  switch (element.mediaType) {
    case "text":
      return (
        <>
          {element.mediaText && (
            <p className={cn("leading-relaxed whitespace-pre-line", className)}>
              {element.mediaText}
            </p>
          )}
          <Attachment element={element} />
        </>
      );

    case "image":
      return (
        <figure className="flex flex-col gap-2">
          {element.mediaUrl && (
            <img
              src={element.mediaUrl}
              alt={element.mediaText || "Post image"}
              className="border-border/40 mx-auto max-h-[75vh] w-auto max-w-full rounded-2xl border"
            />
          )}
          {element.mediaText && (
            <figcaption className="text-muted-foreground text-sm">
              {element.mediaText}
            </figcaption>
          )}
        </figure>
      );

    case "video":
      return (
        <figure className="flex flex-col gap-2">
          {element.streamUrl ? (
            <div className="border-border/40 overflow-hidden rounded-2xl border bg-black">
              <InlineVideo element={element} />
            </div>
          ) : (
            element.mediaPreviewImageUrl && (
              <img
                src={element.mediaPreviewImageUrl}
                alt=""
                className="w-full rounded-2xl"
              />
            )
          )}
          {(element.mediaText || element.duration) && (
            <figcaption className="text-muted-foreground text-sm">
              {element.mediaText}
              {element.duration
                ? ` · ${formatDurationMs(element.duration * 1000)}`
                : null}
            </figcaption>
          )}
        </figure>
      );

    case "poll":
      return <PollElement element={element} />;

    case "file":
      return (
        <a
          href={element.mediaUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border/60 hover:bg-foreground/[0.03] flex items-center gap-2 rounded-xl border p-4 text-sm"
        >
          <FileIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{element.mediaText || "Attachment"}</span>
        </a>
      );

    default:
      return null;
  }
}

function AuthorRow({
  post,
  compact = false,
}: {
  post: PortalPost;
  compact?: boolean;
}) {
  const author = useUser(post.creatorUserId);
  const when = post.publishedDate ?? post.createdDate;
  const profileHref = `/profile/${post.creatorUserId}`;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href={profileHref} className="shrink-0" aria-label="Profile">
        <Avatar user={author} className={compact ? "size-8" : "size-11"} />
      </Link>
      <div className="flex min-w-0 flex-col leading-tight">
        <Link
          href={profileHref}
          className="self-start truncate font-bold hover:underline"
        >
          {author?.displayName || author?.username || "…"}
        </Link>
        <span className="text-muted-foreground truncate text-sm">
          {author?.username && (
            // Same destination as the name: one tab stop is enough.
            <Link href={profileHref} tabIndex={-1} className="hover:underline">
              @{author.username}
            </Link>
          )}
          {compact && (
            <>
              {" · "}
              <time dateTime={when}>{new Date(when).toLocaleDateString()}</time>
            </>
          )}
        </span>
        {/* The author's flair, as the app's PostDetailAuthorView tags it. */}
        {author?.flair && (
          <span className="border-border bg-muted text-muted-foreground mt-1 max-w-full self-start truncate rounded-sm border px-1.5 py-px text-xs">
            {author.flair}
          </span>
        )}
      </div>
    </div>
  );
}

function Hashtags({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <HashtagChip key={id} hashtagId={id} />
      ))}
    </div>
  );
}

function QuotedPost({ postId }: { postId: string }) {
  const post = usePost(postId);
  if (!post) return null;
  return (
    <Link
      href={`/postDetail/${postId}`}
      className="border-border/60 hover:bg-foreground/[0.03] flex flex-col gap-2 rounded-2xl border p-4"
    >
      <AuthorRow post={post} compact />
      {post.title && <p className="font-semibold">{post.title}</p>}
      {post.postText && (
        <p className="line-clamp-4 text-sm whitespace-pre-line">
          {post.postText}
        </p>
      )}
    </Link>
  );
}

/** A post's direct replies, oldest first, as Post2.commentsInThreadForm sorts them. */
function useSortedReplies(commentIds: (string | null)[] | undefined) {
  const ids = (commentIds ?? []).filter((id): id is string => !!id);
  const posts = usePosts(ids);
  return ids
    .map((id, i) => ({ id, created: posts[i]?.createdDate ?? "" }))
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((r) => r.id);
}

/**
 * The app's depth lines (CommentView's MurmurCommentDepthWrapper): one thin
 * vertical rule per level below the page's post, down the comment's side.
 */
function DepthLines({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span className="flex shrink-0 self-stretch pr-3" aria-hidden>
      {Array.from({ length: level }, (_, i) => (
        <span key={i} className="bg-muted-foreground/40 ml-1.5 w-px" />
      ))}
    </span>
  );
}

/**
 * A comment followed by its replies, in thread order: the app's
 * commentsInThreadForm, oldest first with each comment's own replies
 * right after it. `level` 0 is a direct reply to the page's post.
 */
function CommentThread({ postId, level }: { postId: string; level: number }) {
  const post = usePost(postId);
  const me = useCurrentUser().data;
  const replies = useSortedReplies(post?.commentIds);
  if (!post) return null;
  // Unpublished (media still processing) shows only to its author, as in the app.
  // Only an explicit false/0 counts; a missing flag means published.
  const processing = post.isPublished != null && !post.isPublished;
  const visible = !processing || post.creatorUserId === me?.userId;
  return (
    <>
      {post.isDeleted ? (
        <li className="text-muted-foreground flex text-sm italic">
          <DepthLines level={level} />
          <span className="border-border/40 flex-1 border-b py-3">
            This post was deleted
          </span>
        </li>
      ) : (
        visible && <Comment post={post} level={level} processing={processing} />
      )}
      {replies.map((id) => (
        <CommentThread key={id} postId={id} level={level + 1} />
      ))}
    </>
  );
}

function Comment({
  post,
  level,
  processing,
}: {
  post: PortalPost;
  level: number;
  processing: boolean;
}) {
  return (
    <li id={`comment-${post.postId}`} className="flex scroll-mt-16">
      <DepthLines level={level} />
      {/* The separator sits inside the indent, as in the app, so the depth
          lines run unbroken down a thread. */}
      <div className="border-border/40 flex min-w-0 flex-1 flex-col gap-2 border-b py-4">
        <AuthorRow post={post} compact />
        {processing ? (
          <p className="text-muted-foreground italic">
            [This post is being processed. Please stand by.]
          </p>
        ) : (
          <PostBody post={post} />
        )}
        <div className="flex items-center gap-6">
          <LikeCounter post={post} />
        </div>
      </div>
    </li>
  );
}

/**
 * A post's content is its media elements in indexInPost order — text
 * elements included; postText is derived from them by the backend, so
 * rendering both shows the text twice. postText is used only as a stand-in
 * until the elements have arrived in the store.
 */
function PostBody({
  post,
  className,
}: {
  post: PortalPost;
  className?: string;
}) {
  const elements = useMediaElements(post.mediaElementIds);
  const hydrated = elements.some(Boolean);
  if (!hydrated) {
    return post.postText ? (
      <p className={cn("leading-relaxed whitespace-pre-line", className)}>
        {post.postText}
      </p>
    ) : null;
  }
  const order = post.mediaElementIds
    .map((id, i) => ({
      id,
      index: elements[i]?.indexInPost ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.index - b.index);
  return (
    <>
      {order.map(({ id }) => (
        <MediaElement key={id} id={id} className={className} />
      ))}
    </>
  );
}

/**
 * The full post page. Reads everything from the entity store, which the
 * feed's prefetch usually filled already; useFullPost fetches it otherwise
 * and refreshes it in the background when stale.
 */
/** Edit and "Post follow-up", for whoever the app offers them to. */
function AuthorActions({ post }: { post: PortalPost }) {
  const me = useCurrentUser().data;
  const edit = canEditPost(post, me);
  const quote = canQuotePost(post, me);
  if (!edit && !quote) return null;
  const pill =
    "border-border hover:bg-foreground/[0.04] flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors";
  return (
    <div className="flex flex-wrap gap-2">
      {edit && (
        <Link href={`${composeHref}?edit=${post.postId}`} className={pill}>
          <SquareAndPencilIcon className="size-4" />
          Edit
        </Link>
      )}
      {quote && (
        <Link href={`${composeHref}?quote=${post.postId}`} className={pill}>
          <TextQuoteIcon className="size-4" />
          Post follow-up
        </Link>
      )}
    </div>
  );
}

export default function PostDetail({ postId }: { postId: string }) {
  const full = useFullPost(postId);
  const post = usePost(postId);
  const group = usePostGroupLoaded(post?.postGroupId);
  const replyIds = useSortedReplies(post?.commentIds);

  if (!post) {
    if (full.status === "error")
      return <PortalError error={full.error} retry={() => full.refetch()} />;
    return (
      <div aria-busy="true">
        <PostCardSkeleton />
      </div>
    );
  }

  const when = post.publishedDate ?? post.createdDate;
  const commentIds = replyIds;

  return (
    <article className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <AuthorRow post={post} />
        {group?.groupName && (
          <span className="text-accent-alt max-w-[40%] shrink-0 truncate text-xs">
            {group.groupName}
          </span>
        )}
      </div>

      {post.title && (
        <h1 className="text-2xl leading-tight font-bold">{post.title}</h1>
      )}
      <PostBody post={post} className="text-lg" />
      {post.quotedPostId && <QuotedPost postId={post.quotedPostId} />}
      {post.hashtagIds && post.hashtagIds.length > 0 && (
        <Hashtags ids={post.hashtagIds} />
      )}

      <p className="text-muted-foreground text-sm">
        <time dateTime={when}>{new Date(when).toLocaleString()}</time>
        {post.numUniqueViews ? ` · ${post.numUniqueViews} views` : null}
        {full.isFetching && post.mediaElementIds.length > 0
          ? " · updating…"
          : null}
      </p>

      <AuthorActions post={post} />

      <PostCounters
        post={post}
        className="border-border/40 gap-8 border-y py-3"
      />

      {full.status === "error" && (
        <PortalError error={full.error} retry={() => full.refetch()} />
      )}

      {commentIds.length > 0 && (
        <section aria-label="Comments">
          <ul>
            {commentIds.map((id) => (
              <CommentThread key={id} postId={id} level={0} />
            ))}
          </ul>
        </section>
      )}
      {commentIds.length === 0 && full.status === "success" && (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      )}
    </article>
  );
}
