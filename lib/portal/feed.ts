import {
  type QueryClient,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import {
  FEED_GROUP_ID,
  GET_FULL_POST_DATA,
  GET_POSTS_IN_GROUP,
  type GetFullPostDataData,
  type GetPostsInGroupData,
} from "./queries";
import { ingestStore } from "./store";

/** The app asks for 5 then 10; a browser viewport shows more, so 10 and 10. */
export const FEED_PAGE_SIZE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FeedCursor {
  lastPostId: string;
  requestDate: string;
}

export interface FeedPage {
  postIds: string[];
  requestDate: string;
  endOfList: boolean;
}

/** The feed and every group list share this; the feed is the sentinel group. */
export function postListKey(postGroupId: string, categoryIds: string[] = []) {
  return ["posts", postGroupId, categoryIds] as const;
}

async function fetchPostsPage(
  client: QueryClient,
  postGroupId: string,
  categoryIds: string[],
  cursor: FeedCursor | null,
): Promise<FeedPage> {
  const data = await portalQuery<GetPostsInGroupData>(GET_POSTS_IN_GROUP, {
    postGroupId,
    categoryIds: categoryIds.length ? categoryIds : null,
    count: FEED_PAGE_SIZE,
    // First page: stamp now, as the app does on reset. Later pages echo the
    // server's own requestDate back so the window stays pinned.
    requestDate: cursor?.requestDate ?? new Date().toISOString(),
    lastPostIdReceived: cursor?.lastPostId ?? null,
  });
  const res = data.getPostsInGroup;
  if (!res.success) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't load posts",
      res.errorCode,
    );
  }
  ingestStore(client, res.store);
  // The id list can carry ad insertions that aren't posts; the app skips
  // anything that isn't a 36-character id, and so do we.
  const postIds = (res.results?.postIds ?? []).filter(
    (id): id is string => typeof id === "string" && UUID.test(id),
  );
  return { postIds, requestDate: res.requestDate, endOfList: res.endOfList };
}

export function usePostList(postGroupId: string, categoryIds: string[] = []) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: postListKey(postGroupId, categoryIds),
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) =>
      fetchPostsPage(client, postGroupId, categoryIds, pageParam),
    getNextPageParam: (last): FeedCursor | undefined => {
      const lastPostId = last.postIds.at(-1);
      if (last.endOfList || !lastPostId) return undefined;
      return { lastPostId, requestDate: last.requestDate };
    },
    staleTime: 60_000,
  });
}

export function useFeed() {
  return usePostList(FEED_GROUP_ID);
}

/**
 * Hydrates one post fully into the store. The query's own data is just a
 * marker that the hydration happened; components read the entities.
 * Shared by the detail page (useFullPost) and the feed's prefetch, so a
 * prefetched post is the same cache entry the page then finds warm.
 */
export function fullPostOptions(client: QueryClient, postId: string) {
  return queryOptions({
    queryKey: ["postFull", postId],
    queryFn: async () => {
      const data = await portalQuery<GetFullPostDataData>(GET_FULL_POST_DATA, {
        postIds: [postId],
      });
      const res = data.getFullPostData;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load the post",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
      const found =
        res.store?.posts?.some((p) => p?.postId === postId) ?? false;
      if (!found) throw new PortalApiError("Post not found", 404);
      return { postId, loadedAt: Date.now() };
    },
    staleTime: 5 * 60_000,
  });
}

export function useFullPost(postId: string) {
  const client = useQueryClient();
  return useQuery(fullPostOptions(client, postId));
}

export function prefetchFullPost(client: QueryClient, postId: string) {
  return client.prefetchQuery(fullPostOptions(client, postId));
}
