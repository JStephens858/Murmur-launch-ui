"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import BackButton from "./back-button";
import { PortalError } from "./feed";
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
  if (!post) return null;
  const body = elements.filter((e): e is PortalMediaElement => !!e);
  const showAvatar = !mine && groupChat;
  return (
    <li
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
            body.map((e) => <MessageMedia key={e.mediaElementId} element={e} />)
          ) : (
            <span className="whitespace-pre-line">{post.postText}</span>
          )}
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
export default function Conversation({ postGroupId }: { postGroupId: string }) {
  const { data: me } = useCurrentUser();
  const thread = useThread(postGroupId);
  const send = useSendMessage(postGroupId);
  const markSeen = useMarkConversationSeen();
  const members = useMembers(postGroupId);
  const memberCount = members.data?.pages[0]?.memberCount ?? 0;
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastNewest = useRef<string | null>(null);
  const prevHeight = useRef(0);

  // Seen on open and on leave.
  const markSeenMutate = markSeen.mutate;
  const loaded = thread.head.isSuccess;
  useEffect(() => {
    if (!loaded) return;
    markSeenMutate(postGroupId);
    return () => markSeenMutate(postGroupId);
  }, [loaded, postGroupId, markSeenMutate]);

  // Stay pinned to the bottom when new messages land; keep the viewport
  // still when older ones are prepended above.
  const newest = thread.postIds.at(-1) ?? null;
  const oldestId = thread.postIds[0] ?? null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (newest !== lastNewest.current) {
      lastNewest.current = newest;
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    } else if (el.scrollHeight !== prevHeight.current && prevHeight.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    }
    prevHeight.current = el.scrollHeight;
  }, [newest, oldestId, thread.postIds.length]);

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
    if (!body || send.isPending) return;
    stickToBottom.current = true;
    send.mutate(body, { onSuccess: () => setText("") });
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
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-border/40 bg-background flex items-end gap-2 border-t px-3 py-2"
      >
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
          className="border-border/60 bg-card focus-visible:ring-ring max-h-40 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <Button
          type="submit"
          variant="glow"
          size="sm"
          disabled={!text.trim() || send.isPending}
        >
          Send
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
