import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { CurrentUser } from "./current-user";
import { PortalApiError, portalQuery } from "./graphql";
import { FEED_GROUP_ID } from "./queries";
import { STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type {
  MurmurResponse,
  PortalPostGroup,
  PortalPostGroupCategory,
  StoreData,
} from "./types";

/**
 * Groups, as the app's GroupListView / PostListView / PostGroupDetailsView
 * do them: one getAllPostGroups call for the list (sorted client-side,
 * subscribed first then by name, direct-message groups dropped), access
 * decided client-side from the group type and its `restrictions` JSON,
 * join/leave/request-access mutations, and "watching" as a notification
 * preference separate from membership.
 */

const GROUP_FIELDS = /* GraphQL */ `
  postGroupId
  indexInParent
  pinnedPostId
  groupName
  description
  groupType
  memberCount
  moderatorUserIds
  subscribed
  sponsored
  sponsor
  iconUrl
  restrictions
  inviteDisposition
  canPost
  canLeave
  postFilter
  categories {
    categoryId
    order
    key
    name
    subtitle
    parentCategoryId
    categoryDisplayStyle
    hasChildren
    displayStyle
  }
  numUnseenMessages
  onlyModsCanSetCategory
  isVisibleInList
  canSeeGroupDetails
  userScore
`;

const GET_ALL_POST_GROUPS = /* GraphQL */ `
  query getAllPostGroups {
    getAllPostGroups {
      success
      errorMsg
      errorCode
      results {
        ${GROUP_FIELDS}
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

type GroupRow = PortalPostGroup & { memberCount: number; subscribed: boolean };

interface GetAllPostGroupsData {
  getAllPostGroups: MurmurResponse & {
    results: GroupRow[];
    store: StoreData | null;
  };
}

export const groupsKey = ["groups"] as const;

/** Every group the API will show this reader, sorted as the app sorts. */
export function useGroups() {
  const client = useQueryClient();
  return useQuery({
    queryKey: groupsKey,
    queryFn: async (): Promise<string[]> => {
      const data = await portalQuery<GetAllPostGroupsData>(GET_ALL_POST_GROUPS);
      const res = data.getAllPostGroups;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load groups",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const rows = res.results
        .filter((g) => g.groupType !== "direct_message")
        .sort(
          (a, b) =>
            Number(b.subscribed) - Number(a.subscribed) ||
            a.groupName.localeCompare(b.groupName, undefined, {
              sensitivity: "base",
            }),
        );
      for (const g of rows) {
        client.setQueryData<PortalPostGroup>(
          entityKey.group(g.postGroupId),
          (prev) => ({
            ...prev,
            ...g,
          }),
        );
      }
      return rows.map((g) => g.postGroupId);
    },
    staleTime: 5 * 60_000,
  });
}

/* ── Access rules (PostGroup.swift userCanAccess / userCanSeeInGroups) ─── */

interface Restrictions {
  userClass: string[];
  canRequestAccessUserClass: string[];
}

export function parseRestrictions(group: PortalPostGroup): Restrictions {
  const empty = { userClass: [], canRequestAccessUserClass: [] };
  if (!group.restrictions) return empty;
  try {
    const r = JSON.parse(group.restrictions);
    return {
      userClass: Array.isArray(r?.userClass) ? r.userClass : [],
      canRequestAccessUserClass: Array.isArray(r?.canRequestAccessUserClass)
        ? r.canRequestAccessUserClass
        : [],
    };
  } catch {
    return empty;
  }
}

/** Can this reader open the group's posts? */
export function userCanAccess(
  group: PortalPostGroup,
  user: CurrentUser | null | undefined,
) {
  if (!user) return false;
  if (user.isAdmin > 99) return true;
  if (group.groupType === "public" || group.subscribed) return true;
  if (group.groupType === "restricted") {
    return parseRestrictions(group).userClass.includes(user.userClass);
  }
  return false;
}

/** Should the group appear in the "other groups" section at all? */
export function userCanSeeInGroups(
  group: PortalPostGroup,
  user: CurrentUser | null | undefined,
) {
  if (userCanAccess(group, user)) return true;
  return (
    group.groupType === "private" &&
    !!user &&
    parseRestrictions(group).canRequestAccessUserClass.includes(user.userClass)
  );
}

/** Which button the row shows, per GroupJoinButton.swift. */
export type JoinAffordance = "join" | "leave" | "request" | "none";

export function joinAffordance(
  group: PortalPostGroup,
  user: CurrentUser | null | undefined,
  { allowLeave = false } = {},
): JoinAffordance {
  if (!user) return "none";
  if (group.subscribed)
    return allowLeave && (group.canLeave ?? 0) > 0 ? "leave" : "none";
  const r = parseRestrictions(group);
  if (group.groupType === "public") return "join";
  if (group.groupType === "restricted")
    return r.userClass.includes(user.userClass) ? "join" : "none";
  if (group.groupType === "private") {
    return r.canRequestAccessUserClass.includes(user.userClass)
      ? "request"
      : "none";
  }
  return "none";
}

/** The categories that become tabs: header-style, or top-level browsers. */
export function pickerCategories(
  group: PortalPostGroup,
): PortalPostGroupCategory[] {
  return (group.categories ?? [])
    .filter(
      (c) =>
        c.categoryDisplayStyle === "header" ||
        (c.categoryDisplayStyle === "browser" && !c.parentCategoryId),
    )
    .sort((a, b) => a.order - b.order);
}

export function childCategories(group: PortalPostGroup, parentId: string) {
  return (group.categories ?? [])
    .filter((c) => c.parentCategoryId === parentId)
    .sort((a, b) => a.order - b.order);
}

/* ── Membership ─────────────────────────────────────────────────────── */

const JOIN = /* GraphQL */ `
  mutation joinPostGroup($postGroupId: ID!) {
    joinPostGroup(postGroupId: $postGroupId) {
      success
      errorMsg
      errorCode
      results {
        postGroupId
        canPost
        canLeave
        postFilter
        subscribed
      }
    }
  }
`;
const LEAVE = JOIN.replace(/joinPostGroup/g, "leavePostGroup");

interface JoinLeaveData {
  [key: string]: MurmurResponse & {
    results: {
      postGroupId: string;
      canPost: boolean;
      canLeave: boolean;
      subscribed: boolean;
    } | null;
  };
}

function setGroup(
  client: QueryClient,
  id: string,
  patch: Partial<PortalPostGroup>,
) {
  client.setQueryData<PortalPostGroup>(entityKey.group(id), (prev) =>
    prev ? { ...prev, ...patch } : prev,
  );
}

/**
 * Join or leave. Flipped optimistically and rolled back on failure, as
 * in PostGroup.joinGroup; the home feed is dropped either way because the
 * app resets its feed model on both (the group's posts appear or vanish).
 */
export function useJoinGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postGroupId,
      join,
    }: {
      postGroupId: string;
      join: boolean;
    }) => {
      const key = join ? "joinPostGroup" : "leavePostGroup";
      const data = await portalQuery<JoinLeaveData>(join ? JOIN : LEAVE, {
        postGroupId,
      });
      const res = data[key];
      if (!res.success || !res.results) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't update membership",
          res.errorCode,
        );
      }
      return res.results;
    },
    onMutate: async ({ postGroupId, join }) => {
      const previous = client.getQueryData<PortalPostGroup>(
        entityKey.group(postGroupId),
      );
      setGroup(client, postGroupId, {
        subscribed: join,
        memberCount: Math.max(
          0,
          (previous?.memberCount ?? 0) + (join ? 1 : -1),
        ),
      });
      return { previous };
    },
    onSuccess: (results, { postGroupId }) => {
      setGroup(client, postGroupId, {
        subscribed: results.subscribed,
        canPost: results.canPost ? 1 : 0,
        canLeave: results.canLeave ? 1 : 0,
      });
    },
    onError: (_e, { postGroupId }, context) => {
      if (context?.previous)
        client.setQueryData(entityKey.group(postGroupId), context.previous);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["posts", FEED_GROUP_ID] });
      client.invalidateQueries({ queryKey: groupsKey });
    },
  });
}

const REQUEST_ACCESS = /* GraphQL */ `
  mutation requestAccessToPostGroup($postGroupId: ID!, $message: String) {
    requestAccessToPostGroup(postGroupId: $postGroupId, message: $message) {
      success
      errorMsg
      errorCode
    }
  }
`;

export function useRequestAccess() {
  return useMutation({
    mutationFn: async ({
      postGroupId,
      message,
    }: {
      postGroupId: string;
      message: string;
    }) => {
      const data = await portalQuery<{
        requestAccessToPostGroup: MurmurResponse;
      }>(REQUEST_ACCESS, { postGroupId, message });
      const res = data.requestAccessToPostGroup;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't send your request",
          res.errorCode,
        );
      }
    },
  });
}

/* ── Watching (a notification preference, not membership) ───────────── */

const GET_PREFS = /* GraphQL */ `
  query getPostGroupPreferences($postGroupIds: [ID!]!) {
    getPostGroupPreferences(postGroupIds: $postGroupIds) {
      success
      errorMsg
      errorCode
      results {
        postGroupId
        watchingGroup
      }
    }
  }
`;
const SET_PREFS = /* GraphQL */ `
  mutation setPostGroupPreferences($preferences: [PostGroupPreferenceInput!]!) {
    setPostGroupPreferences(preferences: $preferences) {
      success
      errorMsg
      errorCode
    }
  }
`;

export function useWatchingGroup(postGroupId: string) {
  const client = useQueryClient();
  const key = ["groupPrefs", postGroupId] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<boolean> => {
      const data = await portalQuery<{
        getPostGroupPreferences: MurmurResponse & {
          results: { postGroupId: string; watchingGroup: number | null }[];
        };
      }>(GET_PREFS, { postGroupIds: [postGroupId] });
      const res = data.getPostGroupPreferences;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load preferences",
          res.errorCode,
        );
      }
      return (
        (res.results.find((r) => r.postGroupId === postGroupId)
          ?.watchingGroup ?? 0) > 0
      );
    },
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: async (watching: boolean) => {
      const data = await portalQuery<{
        setPostGroupPreferences: MurmurResponse | null;
      }>(SET_PREFS, {
        preferences: [{ postGroupId, watchingGroup: watching ? 1 : 0 }],
      });
      const res = data.setPostGroupPreferences;
      if (res && !res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't update watching",
          res.errorCode,
        );
      }
    },
    onMutate: async (watching) => {
      const previous = client.getQueryData<boolean>(key);
      client.setQueryData(key, watching);
      return { previous };
    },
    onError: (_e, _w, context) => client.setQueryData(key, context?.previous),
  });
  return {
    watching: query.data ?? false,
    loaded: query.isSuccess,
    setWatching: mutation.mutate,
  };
}

/* ── People ─────────────────────────────────────────────────────────── */

export interface GroupModerator {
  userId: string;
  username: string;
  displayName: string;
  userClass: string;
  isEmployee: number;
  hidden: number;
}

const GET_MODERATORS = /* GraphQL */ `
  query getModeratorsInGroup($postGroupId: ID!, $count: Int) {
    getModeratorsInGroup(postGroupId: $postGroupId, count: $count) {
      success
      errorMsg
      errorCode
      results {
        moderators {
          userId
          username
          displayName
          userClass
          isEmployee
          hidden
        }
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

export function useModerators(postGroupId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["groupModerators", postGroupId],
    queryFn: async (): Promise<GroupModerator[]> => {
      const data = await portalQuery<{
        getModeratorsInGroup: MurmurResponse & {
          results: { moderators: GroupModerator[] } | null;
          store: StoreData | null;
        };
      }>(GET_MODERATORS, { postGroupId, count: 50 });
      const res = data.getModeratorsInGroup;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load moderators",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      return (res.results?.moderators ?? []).filter((m) => m.hidden === 0);
    },
    staleTime: 5 * 60_000,
  });
}

export const MEMBERS_PAGE_SIZE = 30;

const GET_MEMBERS = /* GraphQL */ `
  query getMembersInGroup($postGroupId: ID!, $offset: Int!, $count: Int!) {
    getMembersInGroup(
      postGroupId: $postGroupId
      offset: $offset
      count: $count
    ) {
      success
      errorMsg
      errorCode
      results {
        moderatorCount
        memberCount
        memberUserIds
        moderatorUserIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

/** Members 30 at a time by offset, users landing in the entity store. */
export function useMembers(postGroupId: string) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: ["groupMembers", postGroupId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const data = await portalQuery<{
        getMembersInGroup: MurmurResponse & {
          results: {
            memberCount: number;
            memberUserIds: string[];
            moderatorUserIds: string[] | null;
          } | null;
          store: StoreData | null;
        };
      }>(GET_MEMBERS, {
        postGroupId,
        offset: pageParam,
        count: MEMBERS_PAGE_SIZE,
      });
      const res = data.getMembersInGroup;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load members",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const ids = res.results?.memberUserIds ?? [];
      return {
        userIds: ids,
        memberCount: res.results?.memberCount ?? ids.length,
        nextOffset: pageParam + ids.length,
        endOfList: ids.length < MEMBERS_PAGE_SIZE,
      };
    },
    getNextPageParam: (last) => (last.endOfList ? undefined : last.nextOffset),
    staleTime: 5 * 60_000,
  });
}
