import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { VideosSource } from "@/components/sections/videos/browser";
import { buildVideosPage, type PublicVideosPage } from "@/lib/video-page";

import { PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { ingestStore } from "./store";
import type { MurmurResponse, StoreData } from "./types";

/**
 * The signed-in videos list: the app's getVideosForUser, personalised by
 * the backend and paged per type by the last post id received. Its store
 * is ingested so the player can show like state and counts for each post.
 * Hashtag filtering isn't an argument of this query, so the browser's tag
 * chips fall back to the public list for that one case.
 */

const GET_VIDEOS_FOR_USER = /* GraphQL */ `
  query getVideosForUser(
    $resetList: Boolean
    $shortCount: Int
    $longCount: Int
    $lastShortPostId: ID
    $lastLongPostId: ID
  ) {
    getVideosForUser(
      resetList: $resetList
      shortCount: $shortCount
      longCount: $longCount
      continueWatchingCount: 0
      lastShortPostId: $lastShortPostId
      lastLongPostId: $lastLongPostId
    ) {
      success
      errorMsg
      errorCode
      results {
        shortVideoPostIds
        longVideoPostIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface GetVideosForUserData {
  getVideosForUser: MurmurResponse & {
    results: { shortVideoPostIds: string[]; longVideoPostIds: string[] } | null;
    store: StoreData | null;
  };
}

export const INITIAL_COUNT = 24;

export function usePortalVideosSource(): VideosSource {
  const client = useQueryClient();
  return async ({ type, count, cursor, hashtagId }) => {
    if (hashtagId) {
      // Not supported by getVideosForUser; the public route filters by tag.
      const { publicVideosSource } =
        await import("@/components/sections/videos/browser");
      return publicVideosSource({ type, count, cursor, hashtagId });
    }
    const longCount = type === "short" ? 0 : count;
    const shortCount = type === "long" ? 0 : count;
    const data = await portalQuery<GetVideosForUserData>(GET_VIDEOS_FOR_USER, {
      resetList: !cursor,
      longCount,
      shortCount,
      lastLongPostId: type === "long" ? (cursor ?? null) : null,
      lastShortPostId: type === "short" ? (cursor ?? null) : null,
    });
    const res = data.getVideosForUser;
    if (!res.success) {
      throw new PortalApiError(
        res.errorMsg ?? "Couldn't load videos",
        res.errorCode,
      );
    }
    ingestStore(client, res.store);
    return buildVideosPage(
      {
        longIds: res.results?.longVideoPostIds ?? [],
        shortIds: res.results?.shortVideoPostIds ?? [],
        store: res.store,
      },
      { longCount, shortCount },
    );
  };
}

/** The first page, cached so returning to the tab doesn't refetch. */
export function usePortalVideos(source: VideosSource) {
  return useQuery<PublicVideosPage>({
    queryKey: ["videos", "initial"],
    queryFn: () => source({ type: "all", count: INITIAL_COUNT }),
    staleTime: 5 * 60_000,
  });
}
