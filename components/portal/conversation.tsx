"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, Users, X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoPlayer } from "@/components/ui/video-player";
import { useCurrentUser } from "@/lib/portal/current-user";
import { useMembers } from "@/lib/portal/groups";
import {
  useMarkConversationSeen,
  useSendMessage,
  useThread,
} from "@/lib/portal/messages";
import { useMediaElements, usePost, useUser } from "@/lib/portal/store";
import type { PortalMediaElement } from "@/lib/portal/types";
import {
  retryUploads,
  type UploadingPost,
  useUploadingPost,
} from "@/lib/portal/uploads";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import BackButton from "./back-button";
import { useCoarsePointer } from "./compose";
import { useObjectUrl } from "./compose-items";
import { PortalError } from "./feed";
import { CameraOnRectangleIcon, PlayCircleFillIcon } from "./icons";
import PortalPageHeader from "./page-header";

/* Message media are user uploads on the API's media hosts; plain <img>. */
/* eslint-disable @next/next/no-img-element */

/** The app inserts a date line when the gap to the previous message exceeds two hours. */
const DATE_GAP_MS = 2 * 3600_000;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageMedia({ element }: { element: PortalMediaElement }) {
  switch (element.mediaType) {
    case "image":
      return element.mediaUrl || element.mediaPreviewImageUrl ? (
        <img
          src={element.mediaUrl ?? element.mediaPreviewImageUrl ?? ""}
          alt={element.mediaText || ""}
          className="max-h-[250px] w-auto max-w-full rounded-xl"
          loading="lazy"
        />
      ) : null;
    case "video":
      return element.streamUrl ? (
        <div className="max-h-[250px] w-full max-w-sm overflow-hidden rounded-xl bg-black">
          <VideoPlayer
            src={element.streamUrl}
            poster={element.mediaPreviewImageUrl ?? undefined}
            controls
            muted
          />
        </div>
      ) : element.mediaPreviewImageUrl ? (
        <img
          src={element.mediaPreviewImageUrl}
          alt=""
          className="max-h-[250px] rounded-xl"
        />
      ) : null;
    case "file":
      return (
        <a
          href={element.mediaUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {element.mediaText || "Attachment"}
        </a>
      );
    case "text":
      return (
        <>
          {element.mediaText && (
            <span className="whitespace-pre-line">{element.mediaText}</span>
          )}
          {element.attachmentDestinationUrl && (
            <a
              href={element.attachmentDestinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border/60 bg-background/60 text-foreground mt-2 flex flex-col gap-0.5 rounded-lg border p-2 text-xs"
            >
              {element.attachmentImage && (
                <img
                  src={element.attachmentImage}
                  alt=""
                  className="mb-1 max-h-32 w-full rounded object-cover"
                />
              )}
              <span className="font-medium">
                {element.attachmentTitle ?? element.attachmentDestinationUrl}
              </span>
              {element.attachmentDescription && (
                <span className="text-muted-foreground line-clamp-2">
                  {element.attachmentDescription}
                </span>
              )}
            </a>
          )}
        </>
      );
    default:
      return null;
  }
}

/**
 * A message's photo or video while it uploads: the sender's own copy from
 * this browser, with the progress over it, until the server publishes it.
 */
function UploadingMedia({ upload }: { upload: UploadingPost }) {
  const client = useQueryClient();
  const pct = upload.bytesTotal
    ? Math.round((upload.bytesSent / upload.bytesTotal) * 100)
    : 100;
  const status = {
    uploading: `Uploading… ${pct}%`,
    processing: "Processing…",
    slow: "Still processing…",
    failed: upload.error ?? "Upload failed",
  }[upload.status];
  return (
    <div className="relative max-w-full overflow-hidden rounded-xl">
      {upload.thumbUrl &&
        (upload.thumbIsVideo ? (
          <video
            src={upload.thumbUrl}
            muted
            playsInline
            preload="metadata"
            className="max-h-[250px] max-w-full opacity-70"
          />
        ) : (
          <img
            src={upload.thumbUrl}
            alt=""
            className="max-h-[250px] max-w-full opacity-70"
          />
        ))}
      <span
        role="status"
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 px-2 py-1 text-xs text-white"
      >
        {status}
        {upload.status === "failed" && (
          <button
            type="button"
            onClick={() => retryUploads(client, upload.postId)}
            aria-label="Retry upload"
            className="rounded-full p-0.5 hover:bg-white/20"
          >
            <RotateCw className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * ConversationCell: a bubble on the right for mine, the left for others,
 * the sender's name above the first of a run and their avatar beside the
 * last, both only in group conversations. The time shows on hover; the
 * app reveals it with a drag.
 */
function Message({
  postId,
  mine,
  firstInRun,
  lastInRun,
  groupChat,
}: {
  postId: string;
  mine: boolean;
  firstInRun: boolean;
  lastInRun: boolean;
  groupChat: boolean;
}) {
  const post = usePost(postId);
  const author = useUser(post?.creatorUserId);
  const elements = useMediaElements(post?.mediaElementIds ?? []);
  const upload = useUploadingPost(postId);
  if (!post) return null;
  const body = elements.filter((e): e is PortalMediaElement => !!e);
  const isMedia = (e: PortalMediaElement) =>
    e.mediaType === "image" || e.mediaType === "video";
  const showAvatar = !mine && groupChat;
  return (
    <li
      data-msg={postId}
      className={cn(
        "group flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {showAvatar && (
        <span className="w-8 shrink-0">
          {lastInRun && <Avatar user={author} className="size-8" />}
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[78%] flex-col",
          mine ? "items-end" : "items-start",
        )}
      >
        {!mine && groupChat && firstInRun && (
          <span className="text-muted-foreground mb-0.5 px-1 text-xs">
            {author?.displayName || author?.username}
          </span>
        )}
        <div
          className={cn(
            "flex flex-col gap-1 rounded-2xl px-3 py-2 text-sm leading-relaxed",
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm",
            !lastInRun && (mine ? "rounded-br-2xl" : "rounded-bl-2xl"),
          )}
          title={new Date(post.createdDate).toLocaleString()}
        >
          {body.length > 0 ? (
            body.map((e) =>
              upload && isMedia(e) ? (
                <UploadingMedia key={e.mediaElementId} upload={upload} />
              ) : (
                <MessageMedia key={e.mediaElementId} element={e} />
              ),
            )
          ) : (
            <span className="whitespace-pre-line">{post.postText}</span>
          )}
          {upload && !body.some(isMedia) && <UploadingMedia upload={upload} />}
        </div>
        <time
          dateTime={post.createdDate}
          className="text-muted-foreground px-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
        >
          {timeOf(post.createdDate)}
        </time>
      </div>
    </li>
  );
}

function DateLine({ iso }: { iso: string }) {
  return (
    <li
      className="text-muted-foreground my-2 text-center text-xs"
      aria-label="Date"
    >
      {new Date(iso).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </li>
  );
}

function MessageStream({
  postIds,
  myUserId,
  groupChat,
}: {
  postIds: string[];
  myUserId?: string;
  groupChat: boolean;
}) {
  // Author and date per id, from the store, to decide runs and separators.
  return (
    <ul className="flex flex-col gap-1 px-4 py-3">
      {postIds.map((id, i) => (
        <StreamItem
          key={id}
          postId={id}
          prevId={postIds[i - 1] ?? null}
          nextId={postIds[i + 1] ?? null}
          myUserId={myUserId}
          groupChat={groupChat}
        />
      ))}
    </ul>
  );
}

function StreamItem({
  postId,
  prevId,
  nextId,
  myUserId,
  groupChat,
}: {
  postId: string;
  prevId: string | null;
  nextId: string | null;
  myUserId?: string;
  groupChat: boolean;
}) {
  const post = usePost(postId);
  const prev = usePost(prevId);
  const next = usePost(nextId);
  if (!post) return null;
  const gap = prev
    ? new Date(post.createdDate).getTime() -
      new Date(prev.createdDate).getTime()
    : Infinity;
  return (
    <>
      {gap > DATE_GAP_MS && <DateLine iso={post.createdDate} />}
      <Message
        postId={postId}
        mine={post.creatorUserId === myUserId}
        firstInRun={
          !prev ||
          prev.creatorUserId !== post.creatorUserId ||
          gap > DATE_GAP_MS
        }
        lastInRun={!next || next.creatorUserId !== post.creatorUserId}
        groupChat={groupChat}
      />
    </>
  );
}

function MembersStrip({
  postGroupId,
  isDoctor,
}: {
  postGroupId: string;
  isDoctor: boolean;
}) {
  const members = useMembers(postGroupId);
  const ids = [
    ...new Set((members.data?.pages ?? []).flatMap((p) => p.userIds)),
  ];
  const count = members.data?.pages[0]?.memberCount ?? ids.length;
  const body = (
    <span className="flex items-center gap-2 text-sm">
      <Users className="size-4" aria-hidden />
      {count} {count === 1 ? "member" : "members"}
      <span className="flex -space-x-2">
        {ids.slice(0, 5).map((id) => (
          <MemberAvatar key={id} userId={id} />
        ))}
      </span>
    </span>
  );
  return isDoctor ? (
    <Link href={`/messages/${postGroupId}/members`} className="hover:underline">
      {body}
    </Link>
  ) : (
    body
  );
}

function MemberAvatar({ userId }: { userId: string }) {
  const user = useUser(userId);
  if (!user?.profilePicThumbnailUrl) return null;
  return <Avatar user={user} className="border-background size-6 border-2" />;
}

/**
 * ConversationView: the thread in its own scroll area, oldest at the top
 * and pinned to the bottom on load and on new messages, older pages
 * fetched when the reader scrolls to the top, a composer underneath.
 * Marks the conversation seen on open and again on leaving (the app does
 * it only on its back button).
 */
/**
 * The app's camera.on.rectangle button: Camera or Photo Library on phones
 * and tablets (its action sheet), straight to the file picker elsewhere.
 * One photo or video per message.
 */
function AttachButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled: boolean;
}) {
  const coarse = useCoarsePointer();
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && /^(image|video)\//.test(file.type)) onPick(file);
  };
  const button = (
    <button
      type="button"
      disabled={disabled}
      aria-label="Add a photo or video"
      onClick={coarse ? undefined : () => library.current?.click()}
      className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 mb-1 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40"
    >
      <CameraOnRectangleIcon className="size-6" />
    </button>
  );
  return (
    <>
      {coarse ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onSelect={() => camera.current?.click()}>
              Camera
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => library.current?.click()}>
              Photo Library
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        button
      )}
      <input
        ref={library}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={take}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={take}
      />
    </>
  );
}

/** The picked photo or video above the text, with a remove button. */
function AttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const url = useObjectUrl(file);
  const video = file.type.startsWith("video/");
  return (
    <div className="relative mx-3 mt-2 mb-1 self-start">
      {url &&
        (video ? (
          <span className="relative block">
            <video
              src={url}
              muted
              playsInline
              preload="metadata"
              className="border-border/60 max-h-[100px] max-w-[200px] rounded-xl border"
            />
            <PlayCircleFillIcon className="absolute inset-0 m-auto size-8 text-white drop-shadow" />
          </span>
        ) : (
          <img
            src={url}
            alt=""
            className="border-border/60 max-h-[100px] max-w-[200px] rounded-xl border"
          />
        ))}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="bg-background border-border absolute -top-2 -right-2 rounded-full border p-0.5 shadow-sm"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function Conversation({ postGroupId }: { postGroupId: string }) {
  const { data: me } = useCurrentUser();
  const thread = useThread(postGroupId);
  const send = useSendMessage(postGroupId);
  const markSeen = useMarkConversationSeen();
  const members = useMembers(postGroupId);
  const memberCount = members.data?.pages[0]?.memberCount ?? 0;
  const [text, setText] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastNewest = useRef<string | null>(null);
  /** The message at the top of the view and how far down it sat, while reading older messages. */
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const content = useRef<HTMLDivElement>(null);

  // Seen on open and on leave.
  const markSeenMutate = markSeen.mutate;
  const loaded = thread.head.isSuccess;
  useEffect(() => {
    if (!loaded) return;
    markSeenMutate(postGroupId);
    return () => markSeenMutate(postGroupId);
  }, [loaded, postGroupId, markSeenMutate]);

  /*
   * Two modes. At the bottom, stay there: new messages, a refetch, or
   * content growing as photos and link previews load all keep the newest
   * message in view. Scrolled up, hold still: the message at the top of the
   * view is remembered on scroll and put back at the same spot whenever
   * content changes above it (older messages loading, an image above
   * finishing). The browser's own scroll anchoring is off so the two don't
   * both correct.
   */
  const keepPlace = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const a = anchor.current;
    const target = a && el.querySelector<HTMLElement>(`[data-msg="${a.id}"]`);
    if (!a || !target) return;
    const offset =
      target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop += offset - a.offset;
  }, []);

  const recordPlace = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    const top = el.getBoundingClientRect().top;
    const first = [...el.querySelectorAll<HTMLElement>("[data-msg]")].find(
      (m) => m.getBoundingClientRect().bottom > top,
    );
    anchor.current = first?.dataset.msg
      ? {
          id: first.dataset.msg,
          offset: first.getBoundingClientRect().top - top,
        }
      : null;
  };

  const newest = thread.postIds.at(-1) ?? null;
  const oldestId = thread.postIds[0] ?? null;
  useLayoutEffect(() => {
    // A new message from someone else while reading older ones doesn't move
    // the view; anything else is keepPlace's call.
    if (newest !== lastNewest.current) {
      lastNewest.current = newest;
      if (stickToBottom.current) keepPlace();
      return;
    }
    keepPlace();
  }, [newest, oldestId, thread.postIds.length, keepPlace]);

  // Messages grow after they render (photos, link previews, videos).
  useEffect(() => {
    const inner = content.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => keepPlace());
    observer.observe(inner);
    return () => observer.disconnect();
  }, [keepPlace]);

  const { hasOlder, isLoadingOlder, loadOlder } = thread;
  useEffect(() => {
    const el = topSentinel.current;
    if (!el || !hasOlder) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingOlder) loadOlder();
      },
      { root: scroller.current, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOlder, isLoadingOlder, loadOlder]);

  const submit = () => {
    const body = text.trim();
    if ((!body && !media) || send.isPending) return;
    stickToBottom.current = true;
    send.mutate(
      { text: body, media },
      {
        onSuccess: () => {
          setText("");
          setMedia(null);
        },
      },
    );
  };

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col sm:h-dvh">
      <PortalPageHeader
        title="Messages"
        leading={<BackButton fallback="/messages" />}
        trailing={
          <MembersStrip
            postGroupId={postGroupId}
            isDoctor={me?.userClass === "doctor"}
          />
        }
      />
      <div
        ref={scroller}
        onScroll={recordPlace}
        className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
      >
        <div ref={content}>
          <div ref={topSentinel} aria-hidden />
          {isLoadingOlder && (
            <p className="text-muted-foreground py-2 text-center text-xs">
              Loading...
            </p>
          )}
          {thread.head.status === "pending" && (
            <p className="text-muted-foreground px-4 py-8">Loading...</p>
          )}
          {thread.head.status === "error" && (
            <PortalError
              error={thread.head.error}
              retry={() => thread.head.refetch()}
            />
          )}
          {thread.head.isSuccess && thread.postIds.length === 0 && (
            <p className="text-muted-foreground px-4 py-8">Nothing yet...</p>
          )}
          <MessageStream
            postIds={thread.postIds}
            myUserId={me?.userId}
            groupChat={memberCount > 2}
          />
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-border/40 bg-background flex items-end gap-2 border-t px-3 py-2"
      >
        <AttachButton
          onPick={(file) => setMedia(file)}
          disabled={send.isPending}
        />
        <div className="border-border/60 bg-card focus-within:ring-ring flex min-w-0 flex-1 flex-col rounded-2xl border focus-within:ring-2">
          {media && (
            <AttachmentPreview file={media} onRemove={() => setMedia(null)} />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Enter message"
            aria-label="Message"
            rows={1}
            className="max-h-40 min-h-11 w-full resize-none bg-transparent px-4 py-2.5 text-sm outline-none"
          />
        </div>
        <Button
          type="submit"
          variant="glow"
          size="sm"
          disabled={(!text.trim() && !media) || send.isPending}
        >
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </form>
      {send.isError && (
        <p className="text-destructive-foreground px-4 pb-2 text-xs">
          {send.error instanceof Error ? send.error.message : "Couldn't send."}
        </p>
      )}
    </div>
  );
}
