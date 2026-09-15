/**
 * Server-side client for the MurmurMD GraphQL API (Apollo server, endpoint
 * in MURMUR_API_SERVER). Authenticated calls pass the user's Auth0 access
 * token as a Bearer header. Plain fetch for now — swap in a full GraphQL
 * client if/when the query surface grows.
 */

import {
  buildVideosPage,
  type PublicVideosPage,
  type SiteVideo,
  type VideoHashtag,
} from "./video-page";

export type { PublicVideosPage, SiteVideo, VideoHashtag };

export interface ProfileUser {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePicThumbnailUrl: string | null;
}

const GET_PROFILE_QUERY = /* GraphQL */ `
  query {
    getProfile {
      results {
        user {
          username
          firstName
          lastName
          profilePicThumbnailUrl
        }
      }
    }
  }
`;

interface FetchOptions {
  accessToken?: string;
  variables?: Record<string, unknown>;
  /** Next.js fetch caching; defaults to no-store (right for per-user data). */
  next?: NextFetchRequestConfig;
  /**
   * Bounds the wait on a call whose result gates a response. Used by the
   * ported legacy action endpoints, which must not hang a page render.
   */
  signal?: AbortSignal;
}

export async function fetchMurmurAPI<T>(
  query: string,
  { accessToken, variables, next, signal }: FetchOptions = {},
): Promise<T> {
  const endpoint = process.env.MURMUR_API_SERVER;
  if (!endpoint) {
    throw new Error("MURMUR_API_SERVER is not set");
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    ...(signal ? { signal } : {}),
    ...(next ? { next } : { cache: "no-store" }),
  });
  if (!res.ok) {
    throw new Error(`Murmur API responded ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

interface GetProfileData {
  getProfile: {
    results:
      | { user: ProfileUser | null }
      | { user: ProfileUser | null }[]
      | null;
  } | null;
}

export async function getProfile(
  accessToken: string,
): Promise<ProfileUser | null> {
  const data = await fetchMurmurAPI<GetProfileData>(GET_PROFILE_QUERY, {
    accessToken,
  });
  const results = data.getProfile?.results;
  if (!results) return null;
  return Array.isArray(results) ? (results[0]?.user ?? null) : results.user;
}

/* ── Public videos (unauthenticated) ─────────────────────────────────── */

const GET_PUBLIC_VIDEOS_QUERY = /* GraphQL */ `
  query PublicVideos(
    $longCount: Int
    $shortCount: Int
    $lastLongPostId: ID
    $lastShortPostId: ID
    $hashtagId: ID
  ) {
    getPublicVideosForSite(
      longCount: $longCount
      shortCount: $shortCount
      lastLongPostId: $lastLongPostId
      lastShortPostId: $lastShortPostId
      hashtagId: $hashtagId
    ) {
      results {
        longVideoPostIds
        shortVideoPostIds
      }
      store {
        users {
          userId
          displayName
          username
        }
        posts {
          postId
          title
          postText
          creatorUserId
          publishedDate
          numUniqueViews
          mediaPreviewUrl
          mediaElementIds
          hashtagIds
        }
        hashtags {
          hashtagId
          hashtag
        }
        mediaElements {
          postId
          mediaElementId
          mediaType
          duration
          streamUrl
          mediaPreviewImageUrl
        }
      }
    }
  }
`;

interface PublicVideosData {
  getPublicVideosForSite: {
    results: {
      longVideoPostIds: string[] | null;
      shortVideoPostIds: string[] | null;
    } | null;
    store: {
      users:
        | {
            userId: string;
            displayName: string | null;
            username: string | null;
          }[]
        | null;
      posts:
        | {
            postId: string;
            title: string | null;
            postText: string | null;
            creatorUserId: string | null;
            publishedDate: string | null;
            numUniqueViews: number | null;
            mediaPreviewUrl: string | null;
            mediaElementIds: string[] | null;
            hashtagIds: string[] | null;
          }[]
        | null;
      hashtags: { hashtagId: string; hashtag: string | null }[] | null;
      mediaElements:
        | {
            postId: string | null;
            mediaElementId: string;
            mediaType: string | null;
            duration: number | null;
            streamUrl: string | null;
            mediaPreviewImageUrl: string | null;
          }[]
        | null;
    } | null;
  } | null;
}

export async function getPublicVideos({
  longCount = 30,
  shortCount = 30,
  lastLongPostId = null,
  lastShortPostId = null,
  hashtagId = null,
}: {
  longCount?: number;
  shortCount?: number;
  lastLongPostId?: string | null;
  lastShortPostId?: string | null;
  /** Restrict results to videos carrying this hashtag. */
  hashtagId?: string | null;
} = {}): Promise<PublicVideosPage> {
  const data = await fetchMurmurAPI<PublicVideosData>(GET_PUBLIC_VIDEOS_QUERY, {
    variables: {
      longCount,
      shortCount,
      lastLongPostId,
      lastShortPostId,
      hashtagId,
    },
    // Cache for 5 min in production; locally (next dev) always fetch fresh so
    // new videos show up immediately.
    ...(process.env.NODE_ENV === "production"
      ? { next: { revalidate: 300 } }
      : {}),
  });

  const payload = data.getPublicVideosForSite;
  return buildVideosPage(
    {
      longIds: payload?.results?.longVideoPostIds ?? [],
      shortIds: payload?.results?.shortVideoPostIds ?? [],
      store: payload?.store,
    },
    { longCount, shortCount },
  );
}
