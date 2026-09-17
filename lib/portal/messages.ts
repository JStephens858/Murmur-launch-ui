import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { currentUserKey } from "./current-user";
import { PortalApiError, portalQuery } from "./graphql";
import { FEED_GROUP_ID, STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type {
  MurmurResponse,
  PortalPost,
  PortalUser,
  StoreData,
} from "./types";

/**
 * Direct messages, as the app does them (DirectMessagesView /
 * ConversationView / CreateDMGroupModel): conversations are post groups of
 * type direct_message with no name — a title is computed from the other
 * members; a thread is getPostsInDMGroup, newest first, 20 a page by last
 * post id; a message is an ordinary post (createPost with a text element)
 * into the conversation; a new conversation is createPostGroup, which the
 * backend dedupes by member set; setLastSeenForPostGroup clears unread.
 */

export interface PortalConversation {
  postGroupId: string;
  createdDate: string;
  memberUserIds: string[];
  subscribed: boolean;
  lastPostDate: string | null;
  canPost: number;
  canLeave: number;
  numUnseenMessages: number;
  lastPostId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const THREAD_PAGE_SIZE = 20;

/* ── Conversations ──────────────────────────────────────────────────── */

const GET_CONVERSATIONS = /* GraphQL */ `
  query getDMGroupsForUser2($userId: ID) {
    getDMGroupsForUser2(userId: $userId) {
      success
      errorMsg
      errorCode
      results {
        postGroupId
        createdDate
        memberUserIds
        subscribed
        lastPostDate
        canPost
        canLeave
        numUnseenMessages
        lastPostId
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

export const conversationsKey = ["conversations"] as const;

export function useConversations() {
  const client = useQueryClient();
  return useQuery({
    queryKey: conversationsKey,
    queryFn: async (): Promise<PortalConversation[]> => {
      const data = await portalQuery<{
        getDMGroupsForUser2: MurmurResponse & {
          results: PortalConversation[];
          store: StoreData | null;
        };
      }>(GET_CONVERSATIONS, {});
      const res = data.getDMGroupsForUser2;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load messages",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      // Newest conversation first, by its last message's date as the app
      // sorts (the row's own lastPostDate is the fallback).
      const dateOf = (c: PortalConversation) => {
        const post = c.lastPostId
          ? client.getQueryData<PortalPost>(entityKey.post(c.lastPostId))
          : undefined;
        return new Date(post?.createdDate ?? c.lastPostDate ?? 0).getTime();
      };
      return [...res.results].sort((a, b) => dateOf(b) - dateOf(a));
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/**
 * The app's audienceSummary: first names of everyone but you, "a, b & c",
 * cut at about 35 characters with "& N more"; "Just you so far" if alone.
 */
export function audienceSummary(
  memberUserIds: string[],
  myUserId: string | undefined,
  lookup: (id: string) => PortalUser | undefined,
): string {
  const others = memberUserIds.filter((id) => id !== myUserId);
  if (others.length === 0) return "Just you so far";
  const names = others.map((id) => {
    const u = lookup(id);
    const first = u?.displayName?.trim().split(/\s+/)[0];
    return first || (u?.username ? `@${u.username}` : "…");
  });
  const join = (list: string[]) =>
    list.length <= 1
      ? list.join("")
      : `${list.slice(0, -1).join(", ")} & ${list.at(-1)}`;
  let shown = names.length;
  while (shown > 1 && join(names.slice(0, shown)).length > 35) shown -= 1;
  if (shown === names.length) return join(names);
  return `${names.slice(0, shown).join(", ")} & ${names.length - shown} more`;
}

/* ── Thread ─────────────────────────────────────────────────────────── */

const GET_THREAD_PAGE = /* GraphQL */ `
  query getPostsInDMGroup(
    $postGroupId: ID!
    $count: Int
    $lastPostIdReceived: String
  ) {
    getPostsInDMGroup(
      postGroupId: $postGroupId
      count: $count
      lastPostIdReceived: $lastPostIdReceived
    ) {
      success
      errorMsg
      errorCode
      endOfList
      results {
        postIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface ThreadPage {
  /** Newest first, as the server orders them. */
  postIds: string[];
  endOfList: boolean;
}

async function fetchThreadPage(
  client: QueryClient,
  postGroupId: string,
  lastPostIdReceived: string | null,
): Promise<ThreadPage> {
  const data = await portalQuery<{
    getPostsInDMGroup: MurmurResponse & {
      endOfList: boolean;
      results: { postIds: (string | null)[] } | null;
      store: StoreData | null;
    };
  }>(GET_THREAD_PAGE, {
    postGroupId,
    count: THREAD_PAGE_SIZE,
    lastPostIdReceived,
  });
  const res = data.getPostsInDMGroup;
  if (!res.success) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't load the conversation",
      res.errorCode,
    );
  }
  ingestStore(client, res.store);
  const postIds = (res.results?.postIds ?? []).filter(
    (id): id is string => typeof id === "string" && UUID.test(id),
  );
  return {
    postIds,
    endOfList: res.endOfList || postIds.length < THREAD_PAGE_SIZE,
  };
}

export const threadHeadKey = (id: string) => ["dm", id, "head"] as const;
export const threadOlderKey = (id: string) => ["dm", id, "older"] as const;

/**
 * A thread is two queries: the head (the newest page, refetched every 15s
 * in place of the app's subscription) and the older pages, keyed by the
 * last id of the page before, fetched as the reader scrolls up. The
 * server's cursor page includes the cursor post again, so ids are deduped
 * when the two are merged.
 */
export function useThread(postGroupId: string) {
  const client = useQueryClient();
  const head = useQuery({
    queryKey: threadHeadKey(postGroupId),
    queryFn: () => fetchThreadPage(client, postGroupId, null),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const oldest = head.data?.postIds.at(-1) ?? null;
  const older = useInfiniteQuery({
    queryKey: threadOlderKey(postGroupId),
    initialPageParam: oldest,
    queryFn: ({ pageParam }) => fetchThreadPage(client, postGroupId, pageParam),
    getNextPageParam: (last) =>
      last.endOfList ? undefined : (last.postIds.at(-1) ?? undefined),
    enabled: false, // only on demand, when the reader scrolls to the top
    staleTime: Infinity,
  });

  const seen = new Set<string>();
  const newestFirst: string[] = [];
  for (const id of [
    ...(head.data?.postIds ?? []),
    ...(older.data?.pages ?? []).flatMap((p) => p.postIds),
  ]) {
    if (!seen.has(id)) {
      seen.add(id);
      newestFirst.push(id);
    }
  }
  const olderExhausted = older.data
    ? !older.hasNextPage
    : (head.data?.endOfList ?? false);

  return {
    head,
    /** Oldest at the top, for rendering. */
    postIds: [...newestFirst].reverse(),
    hasOlder: !!head.data && !olderExhausted,
    isLoadingOlder: older.isFetching,
    loadOlder: () => {
      if (!oldest || older.isFetching) return;
      if (older.data) void older.fetchNextPage();
      else void older.refetch();
    },
  };
}

/* ── Sending ────────────────────────────────────────────────────────── */

const CREATE_POST = /* GraphQL */ `
  mutation createPost(
    $postGroupId: ID
    $mediaElements: [UploadedMediaElements]
  ) {
    createPost(postGroupId: $postGroupId, mediaElements: $mediaElements) {
      success
      errorMsg
      errorCode
      results {
        postId
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface CreatePostData {
  createPost: MurmurResponse & {
    results: { postId: string | null } | null;
    store: StoreData | null;
  };
}

async function sendTextMessage(
  client: QueryClient,
  postGroupId: string,
  text: string,
) {
  const data = await portalQuery<CreatePostData>(CREATE_POST, {
    postGroupId,
    mediaElements: [{ indexInPost: 0, mediaType: "text", mediaText: text }],
  });
  const res = data.createPost;
  if (!res.success) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't send your message",
      res.errorCode,
    );
  }
  ingestStore(client, res.store);
  return res.results?.postId ?? null;
}

/** Text only for now; the app also uploads one image or video per message. */
export function useSendMessage(postGroupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      sendTextMessage(client, postGroupId, text.trim()),
    onSuccess: (postId) => {
      if (postId) {
        client.setQueryData<ThreadPage>(threadHeadKey(postGroupId), (page) =>
          page && !page.postIds.includes(postId)
            ? { ...page, postIds: [postId, ...page.postIds] }
            : page,
        );
      }
      void client.invalidateQueries({ queryKey: threadHeadKey(postGroupId) });
      void client.invalidateQueries({ queryKey: conversationsKey });
    },
  });
}

/* ── Read state ─────────────────────────────────────────────────────── */

const SET_LAST_SEEN = /* GraphQL */ `
  mutation setLastSeenForPostGroup($postGroupId: ID!, $lastSeen: DateTimeTz) {
    setLastSeenForPostGroup(postGroupId: $postGroupId, lastSeen: $lastSeen) {
      success
      errorMsg
      errorCode
    }
  }
`;

/**
 * Marks the conversation read up to now (ISO 8601, UTC, trailing Z
 * stripped, as the app sends it) and refreshes the badge sources.
 */
export function useMarkConversationSeen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (postGroupId: string) => {
      const data = await portalQuery<{
        setLastSeenForPostGroup: MurmurResponse;
      }>(SET_LAST_SEEN, {
        postGroupId,
        lastSeen: new Date().toISOString().replace(/Z$/, ""),
      });
      if (!data.setLastSeenForPostGroup.success) {
        throw new PortalApiError(
          data.setLastSeenForPostGroup.errorMsg ?? "Couldn't mark seen",
        );
      }
    },
    onSuccess: (_r, postGroupId) => {
      client.setQueryData<PortalConversation[]>(conversationsKey, (list) =>
        list?.map((c) =>
          c.postGroupId === postGroupId ? { ...c, numUnseenMessages: 0 } : c,
        ),
      );
      void client.invalidateQueries({ queryKey: currentUserKey });
    },
  });
}

/* ── New conversation ───────────────────────────────────────────────── */

const CREATE_DM_GROUP = /* GraphQL */ `
  mutation createPostGroup($memberUserIds: [ID!]!) {
    createPostGroup(
      groupType: direct_message
      groupName: ""
      description: ""
      hidden: false
      sponsored: false
      memberUserIds: $memberUserIds
    ) {
      success
      errorMsg
      errorCode
      results {
        postGroupId
      }
    }
  }
`;

/**
 * createDMGroup in the app: create (or, server-side, find) the
 * conversation for these members, then post the first message into it.
 */
export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberUserIds,
      text,
    }: {
      memberUserIds: string[];
      text: string;
    }) => {
      const data = await portalQuery<{
        createPostGroup: MurmurResponse & {
          results: { postGroupId: string } | null;
        };
      }>(CREATE_DM_GROUP, { memberUserIds });
      const res = data.createPostGroup;
      if (!res.success || !res.results?.postGroupId) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't start the conversation",
          res.errorCode,
        );
      }
      const postGroupId = res.results.postGroupId;
      if (text.trim()) await sendTextMessage(client, postGroupId, text.trim());
      return postGroupId;
    },
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/* ── People: recipients and participants ───────────────────────────── */

const GET_FOLLOWERS = /* GraphQL */ `
  query getFollowers($userId: ID!) {
    getFollowers(userId: $userId) {
      success
      errorMsg
      errorCode
      results {
        followingIds
        followerIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

/** Followers ∪ following, the app's default recipient list. */
export function useContacts(myUserId: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["contacts", myUserId],
    enabled: !!myUserId,
    queryFn: async (): Promise<string[]> => {
      const data = await portalQuery<{
        getFollowers: MurmurResponse & {
          results: { followingIds: string[]; followerIds: string[] } | null;
          store: StoreData | null;
        };
      }>(GET_FOLLOWERS, { userId: myUserId });
      const res = data.getFollowers;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load contacts",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const ids = [
        ...new Set([
          ...(res.results?.followingIds ?? []),
          ...(res.results?.followerIds ?? []),
        ]),
      ];
      const name = (id: string) =>
        client
          .getQueryData<PortalUser>(entityKey.user(id))
          ?.displayName?.toLowerCase() ?? "";
      return ids
        .filter((id) => id !== myUserId)
        .sort((a, b) => name(a).localeCompare(name(b)));
    },
    staleTime: 5 * 60_000,
  });
}

const SEARCH_USERS = /* GraphQL */ `
  query searchUsersForText($searchText: String, $postGroupId: ID, $count: Int) {
    searchUsersForText(
      searchText: $searchText
      postGroupId: $postGroupId
      count: $count
    ) {
      success
      errorMsg
      errorCode
      results {
        userIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

/** Search once the text has three characters; @ and smart quotes stripped as in the app. */
export function useUserSearch(text: string) {
  const client = useQueryClient();
  const searchText = text.replace(/[@“”"]/g, "").trim();
  return useQuery({
    queryKey: ["userSearch", searchText],
    enabled: searchText.length >= 3,
    queryFn: async (): Promise<string[]> => {
      const data = await portalQuery<{
        searchUsersForText: MurmurResponse & {
          results: { userIds: (string | null)[] } | null;
          store: StoreData | null;
        };
      }>(SEARCH_USERS, { searchText, postGroupId: FEED_GROUP_ID, count: 20 });
      const res = data.searchUsersForText;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Search failed",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      return (res.results?.userIds ?? []).filter((id): id is string => !!id);
    },
    staleTime: 60_000,
  });
}

const ADD_USERS = /* GraphQL */ `
  mutation addUsersToPostGroup($postGroupId: ID!, $userIds: [ID!]!) {
    addUsersToPostGroup(postGroupId: $postGroupId, userIds: $userIds) {
      success
      errorMsg
      errorCode
    }
  }
`;
const REMOVE_USERS = ADD_USERS.replace(
  /addUsersToPostGroup/g,
  "removeUsersFromPostGroup",
);

export function useChangeParticipants(postGroupId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userIds,
      add,
    }: {
      userIds: string[];
      add: boolean;
    }) => {
      const key = add ? "addUsersToPostGroup" : "removeUsersFromPostGroup";
      const data = await portalQuery<Record<string, MurmurResponse>>(
        add ? ADD_USERS : REMOVE_USERS,
        {
          postGroupId,
          userIds,
        },
      );
      if (!data[key].success) {
        throw new PortalApiError(
          data[key].errorMsg ?? "Couldn't update participants",
          data[key].errorCode,
        );
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["groupMembers", postGroupId],
      });
      void client.invalidateQueries({ queryKey: conversationsKey });
    },
  });
}
