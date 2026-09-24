import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type { MurmurResponse, PortalUser, StoreData } from "./types";

/**
 * Profiles, as the app's ProfileView2 does them: the person is whatever the
 * store says (fetched with getUsers when missing), counters come from
 * getUserProfileCounters, followers and following from getFollowers (ids
 * only — the people are fetched separately), posts and bookmarks page by
 * date, and following is one mutation toggled optimistically.
 */

/** The app's author for anonymous posts; no message button, no profile. */
export const ANONYMOUS_USER_ID = "37a4cf81-47af-46f2-96f0-b6c719366573";
export const DELETED_USER_ID = "00000000-0000-0000-0000-000000000000";

const GET_USERS = /* GraphQL */ `
  query getUsers($userIds: [ID!]!) {
    getUsers(userIds: $userIds) {
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

async function fetchUsers(client: QueryClient, userIds: string[]) {
  if (userIds.length === 0) return;
  const data = await portalQuery<{
    getUsers: MurmurResponse & {
      results: { userIds: (string | null)[] } | null;
      store: StoreData | null;
    };
  }>(GET_USERS, { userIds });
  const res = data.getUsers;
  if (!res.success)
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't load people",
      res.errorCode,
    );
  ingestStore(client, res.store);
}

/** Makes sure these people are in the store; resolves once they are. */
export function useEnsureUsers(userIds: string[]) {
  const client = useQueryClient();
  const missing = userIds.filter(
    (id) => !client.getQueryData<PortalUser>(entityKey.user(id)),
  );
  return useQuery({
    queryKey: ["users", [...missing].sort()],
    enabled: missing.length > 0,
    queryFn: async () => {
      // The API takes a list; keep requests modest.
      for (let i = 0; i < missing.length; i += 50)
        await fetchUsers(client, missing.slice(i, i + 50));
      return true;
    },
    staleTime: Infinity,
  });
}

const GET_COUNTERS = /* GraphQL */ `
  query getUserProfileCounters($userId: ID) {
    getUserProfileCounters(userId: $userId) {
      success
      errorMsg
      errorCode
      results {
        likedPostCount
        bestAnswerCount
        postOfTheWeekCount
      }
    }
  }
`;

export function useProfileCounters(userId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["profileCounters", userId],
    queryFn: async () => {
      const data = await portalQuery<{
        getUserProfileCounters: MurmurResponse & {
          results: {
            likedPostCount: number;
            bestAnswerCount: number;
            postOfTheWeekCount: number;
          };
        };
      }>(GET_COUNTERS, { userId });
      const res = data.getUserProfileCounters;
      if (!res.success)
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load counters",
          res.errorCode,
        );
      client.setQueryData<PortalUser>(entityKey.user(userId), (prev) =>
        prev ? { ...prev, ...res.results } : prev,
      );
      return res.results;
    },
    staleTime: 60_000,
  });
}

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

export interface Followers {
  followingIds: string[];
  followerIds: string[];
}

export const followersKey = (userId: string) => ["followers", userId] as const;

export function useFollowers(userId: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: followersKey(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<Followers> => {
      const data = await portalQuery<{
        getFollowers: MurmurResponse & {
          results: Followers | null;
          store: StoreData | null;
        };
      }>(GET_FOLLOWERS, { userId });
      const res = data.getFollowers;
      if (!res.success)
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load followers",
          res.errorCode,
        );
      ingestStore(client, res.store);
      return {
        followingIds: res.results?.followingIds ?? [],
        followerIds: res.results?.followerIds ?? [],
      };
    },
    staleTime: 60_000,
  });
}

const FOLLOW_USER = /* GraphQL */ `
  mutation followUser($userId: ID!, $follow: Boolean!) {
    followUser(userId: $userId, follow: $follow) {
      success
      errorMsg
      errorCode
    }
  }
`;

/**
 * Follow or unfollow, flipped locally in both people's follower lists as
 * the app does; unlike the app, put back on failure.
 */
export function useFollowUser(myUserId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      follow,
    }: {
      userId: string;
      follow: boolean;
    }) => {
      const data = await portalQuery<{ followUser: MurmurResponse }>(
        FOLLOW_USER,
        { userId, follow },
      );
      if (!data.followUser.success) {
        throw new PortalApiError(
          data.followUser.errorMsg ?? "Couldn't update follow",
          data.followUser.errorCode,
        );
      }
    },
    onMutate: async ({ userId, follow }) => {
      if (!myUserId) return {};
      const mineKey = followersKey(myUserId);
      const theirsKey = followersKey(userId);
      const mine = client.getQueryData<Followers>(mineKey);
      const theirs = client.getQueryData<Followers>(theirsKey);
      const toggle = (ids: string[], id: string) =>
        follow ? [...new Set([...ids, id])] : ids.filter((x) => x !== id);
      if (mine)
        client.setQueryData(mineKey, {
          ...mine,
          followingIds: toggle(mine.followingIds, userId),
        });
      if (theirs)
        client.setQueryData(theirsKey, {
          ...theirs,
          followerIds: toggle(theirs.followerIds, myUserId),
        });
      return { mine, theirs, mineKey, theirsKey };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.mine) client.setQueryData(ctx.mineKey!, ctx.mine);
      if (ctx?.theirs) client.setQueryData(ctx.theirsKey!, ctx.theirs);
    },
    onSettled: (_r, _e, { userId }) => {
      if (myUserId)
        void client.invalidateQueries({ queryKey: followersKey(myUserId) });
      void client.invalidateQueries({ queryKey: followersKey(userId) });
    },
  });
}

/* ── Posts and bookmarks, paged by date ──────────────────────────────── */

const USER_POSTS = (
  name: "getPostsForUser" | "getBookmarkedPostsForUser",
) => /* GraphQL */ `
  query ${name}($userId: ID, $count: Int, $beforeDate: DateTimeTz) {
    ${name}(userId: $userId, count: $count, includeReplies: false, beforeDate: $beforeDate) {
      success
      errorMsg
      errorCode
      endOfList
      results {
        total
        postIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

export const PROFILE_PAGE_SIZE = 10;

interface UserPostsPage {
  postIds: string[];
  total: number;
  endOfList: boolean;
  /** Cursor for the next page: the oldest post's date. */
  oldest: string | null;
}

export function useUserPosts(userId: string, kind: "posts" | "bookmarks") {
  const client = useQueryClient();
  const name =
    kind === "posts" ? "getPostsForUser" : "getBookmarkedPostsForUser";
  return useInfiniteQuery({
    queryKey: ["userPosts", kind, userId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<UserPostsPage> => {
      const data = await portalQuery<
        Record<
          string,
          MurmurResponse & {
            endOfList: boolean;
            results: { total: number; postIds: (string | null)[] } | null;
            store: StoreData | null;
          }
        >
      >(USER_POSTS(name), {
        userId,
        count: PROFILE_PAGE_SIZE,
        beforeDate: pageParam,
      });
      const res = data[name];
      if (!res.success)
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load posts",
          res.errorCode,
        );
      ingestStore(client, res.store);
      const postIds = (res.results?.postIds ?? []).filter(
        (id): id is string => !!id,
      );
      const dates = postIds
        .map(
          (id) =>
            client.getQueryData<{ createdDate: string }>(entityKey.post(id))
              ?.createdDate,
        )
        .filter((d): d is string => !!d)
        .sort();
      return {
        postIds,
        total: res.results?.total ?? postIds.length,
        endOfList: res.endOfList || postIds.length < PROFILE_PAGE_SIZE,
        oldest: dates[0] ?? null,
      };
    },
    getNextPageParam: (last) =>
      last.endOfList || !last.oldest ? undefined : last.oldest,
    staleTime: 60_000,
  });
}

/* ── Experience (CV items) ─────────────────────────────────────────── */

export interface CVItem {
  itemId: string;
  indexInList: number;
  itemType: string;
  title: string | null;
  practiceType: string | null;
  discipline: string | null;
  companyName: string | null;
  location: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  isCurrent: boolean | null;
}

const GET_CV = /* GraphQL */ `
  query getCVItemsForUser($userId: ID!) {
    getCVItemsForUser(userId: $userId) {
      success
      results {
        items {
          itemId
          indexInList
          itemType
          title
          practiceType
          discipline
          companyName
          location
          description
          start
          end
          isCurrent
        }
      }
    }
  }
`;

export function useCVItems(userId: string) {
  return useQuery({
    queryKey: ["cv", userId],
    queryFn: async (): Promise<CVItem[]> => {
      const data = await portalQuery<{
        getCVItemsForUser: {
          success: boolean;
          results: { items: CVItem[] } | null;
        };
      }>(GET_CV, { userId });
      if (!data.getCVItemsForUser.success)
        throw new PortalApiError("Couldn't load experience");
      return [...(data.getCVItemsForUser.results?.items ?? [])].sort(
        (a, b) => a.indexInList - b.indexInList,
      );
    },
    staleTime: 5 * 60_000,
  });
}
