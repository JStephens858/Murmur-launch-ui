import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { currentUserKey } from "./current-user";
import { PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { ingestStore } from "./store";
import type { MurmurResponse, StoreData } from "./types";

/**
 * Notifications, the way the app does them (NotificationsView.swift):
 * getNotifications2 in pages of 20 keyed by date, row text composed by the
 * server, an icon per kind, and every refresh followed by
 * markNotificationsSeen up to the newest row. "Clear all" is
 * markNotificationsCleared, after which the server stops returning them.
 */

export type NotificationType =
  | "newPostInWatchingGroup"
  | "newPost"
  | "replyPost"
  | "likePost"
  | "bookmarkPost"
  | "newFollower"
  | "priorityPost"
  | "directMessage"
  | "userMentioned"
  | "newDmPost"
  | "replyDmPost"
  | "newUser"
  | "error"
  | "systemAnnouncement"
  | "postGroupAction";

export interface PortalNotification {
  notificationId: string;
  userId: string;
  notificationType: NotificationType;
  /** What a tap opens: a post, a user, a group or a conversation, by kind. */
  notificationDestinationId: string | null;
  /** For replies, the comment itself; otherwise the post. */
  notificationPostId: string | null;
  notificationCreatorId: string | null;
  createdDate: string;
  notificationText: string;
  /** The creator's avatar, joined in by the server. */
  notificationImageUrl: string | null;
  /** 0 unseen, 1 seen, 2 cleared (never returned). */
  seen: number;
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * The server compares these against a MySQL datetime, and the app sends
 * ISO 8601 in UTC with the trailing Z stripped; same here.
 */
export function toApiDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace(/Z$/, "");
}

const FAR_FUTURE = "3000-01-01T00:00:00.000";

const GET_NOTIFICATIONS = /* GraphQL */ `
  query getNotifications2($count: Int, $beforeDate: DateTimeTz) {
    getNotifications2(count: $count, beforeDate: $beforeDate) {
      success
      errorMsg
      errorCode
      results {
        notifications {
          notificationId
          userId
          notificationType
          notificationDestinationId
          notificationPostId
          notificationCreatorId
          createdDate
          notificationText
          notificationImageUrl
          seen
        }
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface GetNotificationsData {
  getNotifications2: MurmurResponse & {
    results: { notifications: PortalNotification[] } | null;
    store: StoreData | null;
  };
}

const MARK_SEEN = /* GraphQL */ `
  mutation markNotificationsSeen($beforeDate: String!) {
    markNotificationsSeen(beforeDate: $beforeDate) {
      success
      errorMsg
      errorCode
    }
  }
`;

const MARK_CLEARED = /* GraphQL */ `
  mutation markNotificationsCleared($beforeDate: String!) {
    markNotificationsCleared(beforeDate: $beforeDate) {
      success
      errorMsg
      errorCode
    }
  }
`;

export const notificationsKey = ["notifications"] as const;

interface NotificationsPage {
  notifications: PortalNotification[];
  endOfList: boolean;
}

export function useNotifications() {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: notificationsKey,
    initialPageParam: FAR_FUTURE,
    queryFn: async ({ pageParam }): Promise<NotificationsPage> => {
      const data = await portalQuery<GetNotificationsData>(GET_NOTIFICATIONS, {
        count: NOTIFICATIONS_PAGE_SIZE,
        beforeDate: pageParam,
      });
      const res = data.getNotifications2;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load notifications",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const notifications = res.results?.notifications ?? [];
      return {
        notifications,
        endOfList: notifications.length < NOTIFICATIONS_PAGE_SIZE,
      };
    },
    getNextPageParam: (last) => {
      const oldest = last.notifications.at(-1);
      if (last.endOfList || !oldest) return undefined;
      return toApiDate(oldest.createdDate);
    },
    // The app refetches on open only if the list is older than five minutes.
    staleTime: 5 * 60_000,
  });
}

async function genericMutation(doc: string, key: string, beforeDate: string) {
  const data = await portalQuery<Record<string, MurmurResponse>>(doc, {
    beforeDate,
  });
  const res = data[key];
  if (!res.success) {
    throw new PortalApiError(res.errorMsg ?? "Request failed", res.errorCode);
  }
}

/**
 * Marks everything up to `newest` seen and re-reads the profile so the
 * sidebar badge drops. Rows already on screen keep their unread styling
 * until the next refresh, as in the app.
 */
export function useMarkNotificationsSeen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (newest: string) =>
      genericMutation(MARK_SEEN, "markNotificationsSeen", toApiDate(newest)),
    onSuccess: () => client.invalidateQueries({ queryKey: currentUserKey }),
  });
}

/** "Clear all": the server hides everything up to `newest` for good. */
export function useClearNotifications() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (newest: string) =>
      genericMutation(
        MARK_CLEARED,
        "markNotificationsCleared",
        toApiDate(newest),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationsKey });
      await client.invalidateQueries({ queryKey: currentUserKey });
    },
  });
}

/** Marks one row seen locally, as the app does on tap. */
export function markSeenLocally(
  client: ReturnType<typeof useQueryClient>,
  notificationId: string,
) {
  client.setQueryData<{ pages: NotificationsPage[]; pageParams: unknown[] }>(
    notificationsKey,
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) =>
            n.notificationId === notificationId ? { ...n, seen: 1 } : n,
          ),
        })),
      },
  );
}

/**
 * Where a tap goes, by kind, using notificationDestinationId as the app
 * does (NotificationsView.swift:164-244). Null means the row is inert:
 * system announcements, and the kinds the app has no handler for either.
 */
export function notificationHref(n: PortalNotification): string | null {
  const id = n.notificationDestinationId;
  if (!id) return null;
  switch (n.notificationType) {
    case "replyPost":
      return n.notificationPostId
        ? `/postDetail/${id}#comment-${n.notificationPostId}`
        : `/postDetail/${id}`;
    case "newPost":
    case "likePost":
    case "bookmarkPost":
    case "userMentioned":
      return `/postDetail/${id}`;
    case "postGroupAction":
      return `/groups/${id}`;
    case "newFollower":
    case "newUser":
      return `/profile/${id}`;
    case "newDmPost":
    case "replyDmPost":
      return `/messages/${id}`;
    default:
      return null;
  }
}
