"use client";

import { useQueryClient } from "@tanstack/react-query";
import { SquarePen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/format";
import { useCurrentUser } from "@/lib/portal/current-user";
import {
  audienceSummary,
  type PortalConversation,
  useConversations,
} from "@/lib/portal/messages";
import { useMediaElements, usePost, useUser } from "@/lib/portal/store";
import { entityKey } from "@/lib/portal/store";
import type { PortalUser } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import { PortalError } from "./feed";
import PortalPageHeader from "./page-header";

/** One conversation, as DMCellView: unread dot, who, when, what was said. */
function ConversationRow({
  conversation: c,
}: {
  conversation: PortalConversation;
}) {
  const client = useQueryClient();
  const { data: me } = useCurrentUser();
  const lastPost = usePost(c.lastPostId);
  const author = useUser(lastPost?.creatorUserId);
  const elements = useMediaElements(lastPost?.mediaElementIds ?? []);
  const title = audienceSummary(c.memberUserIds, me?.userId, (id) =>
    client.getQueryData<PortalUser>(entityKey.user(id)),
  );
  const who =
    lastPost?.creatorUserId === me?.userId
      ? "You"
      : author?.displayName || "Someone";
  const kind = elements.find(
    (e) => e?.mediaType === "image" || e?.mediaType === "video",
  )?.mediaType;
  const when = lastPost?.createdDate ?? c.lastPostDate;
  const unread = c.numUnseenMessages > 0;

  return (
    <li>
      <Link
        href={`/messages/${c.postGroupId}`}
        className="border-border/40 hover:bg-foreground/[0.03] flex gap-3 border-b px-4 py-3"
      >
        <span
          className={cn(
            "bg-primary mt-2 size-2.5 shrink-0 rounded-full",
            !unread && "invisible",
          )}
          aria-label={unread ? "Unread" : undefined}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={cn("truncate", unread ? "font-bold" : "font-semibold")}
            >
              {title}
            </span>
            {when && (
              <time
                dateTime={when}
                className="text-muted-foreground shrink-0 text-xs"
              >
                {formatTimeAgo(when)}
              </time>
            )}
          </span>
          {!lastPost ? (
            <span className="text-muted-foreground text-sm">
              Nothing yet...
            </span>
          ) : kind ? (
            <span className="text-muted-foreground text-sm">
              {who} posted {kind === "video" ? "a video" : "an image"}
            </span>
          ) : (
            <>
              <span className="text-muted-foreground text-sm">{who} said:</span>
              <span className="line-clamp-2 text-sm font-medium">
                {lastPost.postText}
              </span>
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

/** DirectMessagesView: the conversations, newest activity first. */
export default function MessagesList() {
  const conversations = useConversations();
  return (
    <>
      <PortalPageHeader
        title="Messages"
        trailing={
          <Button asChild variant="ghost" size="icon" aria-label="New message">
            <Link href="/messages/new">
              <SquarePen className="size-5" />
            </Link>
          </Button>
        }
      />
      {conversations.status === "pending" && (
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      )}
      {conversations.status === "error" && (
        <PortalError
          error={conversations.error}
          retry={() => conversations.refetch()}
        />
      )}
      {conversations.data && conversations.data.length === 0 && (
        <p className="text-muted-foreground px-4 py-8">Nothing yet...</p>
      )}
      {conversations.data && conversations.data.length > 0 && (
        <ul>
          {conversations.data.map((c) => (
            <ConversationRow key={c.postGroupId} conversation={c} />
          ))}
        </ul>
      )}
    </>
  );
}
