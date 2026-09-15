import {
  type QueryClient,
  skipToken,
  useQueries,
  useQuery,
} from "@tanstack/react-query";

import type {
  PortalHashtag,
  PortalMediaElement,
  PortalPost,
  PortalPostGroup,
  PortalUser,
  StoreData,
} from "./types";

/**
 * The normalised entity store, kept inside TanStack Query's cache: one
 * cache entry per entity, keyed by type and id. Every API response's `store`
 * block is upserted here, so a post fetched by the feed and later hydrated
 * by getFullPostData is one record that every subscribed component sees
 * change. This is the browser counterpart of the app's DataStore, with the
 * cache doing the bookkeeping instead of arrays.
 */

export const entityKey = {
  post: (id: string) => ["post", id] as const,
  user: (id: string) => ["user", id] as const,
  media: (id: string) => ["mediaElement", id] as const,
  hashtag: (id: string) => ["hashtag", id] as const,
  group: (id: string) => ["postGroup", id] as const,
};

function upsert<T extends object>(
  client: QueryClient,
  key: readonly unknown[],
  next: T,
) {
  client.setQueryData<T>(key, (prev) => (prev ? { ...prev, ...next } : next));
}

/** Merges a response's store into the cache. Safe to call with null. */
export function ingestStore(
  client: QueryClient,
  store: StoreData | null | undefined,
) {
  if (!store) return;
  for (const user of store.users ?? []) {
    if (user) upsert(client, entityKey.user(user.userId), user);
  }
  for (const post of store.posts ?? []) {
    if (post) upsert(client, entityKey.post(post.postId), post);
  }
  for (const element of store.mediaElements ?? []) {
    if (element)
      upsert(client, entityKey.media(element.mediaElementId), element);
  }
  for (const tag of store.hashtags ?? []) {
    if (tag) upsert(client, entityKey.hashtag(tag.hashtagId), tag);
  }
  for (const group of store.postGroups ?? []) {
    if (group) upsert(client, entityKey.group(group.postGroupId), group);
  }
}

/**
 * Subscribes to one entity without ever fetching it — entities only arrive
 * through ingestStore. Undefined until then. gcTime is unbounded so the
 * store survives navigating away from the feed and back.
 */
function useEntity<T>(key: readonly unknown[] | null): T | undefined {
  const { data } = useQuery<T>({
    queryKey: key ?? ["entity", "none"],
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return key ? data : undefined;
}

export const usePost = (id: string | null | undefined) =>
  useEntity<PortalPost>(id ? entityKey.post(id) : null);
export const useUser = (id: string | null | undefined) =>
  useEntity<PortalUser>(id ? entityKey.user(id) : null);
export const useMediaElement = (id: string | null | undefined) =>
  useEntity<PortalMediaElement>(id ? entityKey.media(id) : null);
export const useHashtag = (id: string | null | undefined) =>
  useEntity<PortalHashtag>(id ? entityKey.hashtag(id) : null);
export const usePostGroup = (id: string | null | undefined) =>
  useEntity<PortalPostGroup>(id ? entityKey.group(id) : null);

/** Several media elements at once, in the order asked for; undefined gaps. */
export function useMediaElements(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: entityKey.media(id),
      queryFn: skipToken,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
    combine: (results) =>
      results.map((r) => r.data as PortalMediaElement | undefined),
  });
}
