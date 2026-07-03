/**
 * Server-side client for the MurmurMD GraphQL API (Apollo server, endpoint
 * in MURMUR_API_SERVER). Authenticated calls pass the user's Auth0 access
 * token as a Bearer header. Plain fetch for now — swap in a full GraphQL
 * client if/when the query surface grows.
 */

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
}

async function fetchMurmurAPI<T>(
  query: string,
  { accessToken, variables, next }: FetchOptions = {},
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

export interface SiteVideo {
  postId: string;
  kind: "LONG_FORM" | "SHORT_FORM";
  /** Shorts are portrait 9:16, long-form landscape 16:9 (site convention). */
  orientation: "PORTRAIT" | "LANDSCAPE";
  title: string;
  description: string;
  authorName: string | null;
  authorUsername: string | null;
  publishedDate: string | null;
  views: number;
  durationMs: number | null;
  previewImageUrl: string | null;
  streamUrl: string;
}

export interface PublicVideosPage {
  longVideos: SiteVideo[];
  shortVideos: SiteVideo[];
  /** Cursors for the next page (pass as lastLongPostId / lastShortPostId). */
  lastLongPostId: string | null;
  lastShortPostId: string | null;
  /** False once the API returns fewer post ids than requested. */
  longHasMore: boolean;
  shortHasMore: boolean;
}

const GET_PUBLIC_VIDEOS_QUERY = /* GraphQL */ `
  query PublicVideos(
    $longCount: Int
    $shortCount: Int
    $lastLongPostId: ID
    $lastShortPostId: ID
  ) {
    getPublicVideosForSite(
      longCount: $longCount
      shortCount: $shortCount
      lastLongPostId: $lastLongPostId
      lastShortPostId: $lastShortPostId
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
          }[]
        | null;
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

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim();
}

export async function getPublicVideos({
  longCount = 30,
  shortCount = 30,
  lastLongPostId = null,
  lastShortPostId = null,
}: {
  longCount?: number;
  shortCount?: number;
  lastLongPostId?: string | null;
  lastShortPostId?: string | null;
} = {}): Promise<PublicVideosPage> {
  const data = await fetchMurmurAPI<PublicVideosData>(GET_PUBLIC_VIDEOS_QUERY, {
    variables: { longCount, shortCount, lastLongPostId, lastShortPostId },
    next: { revalidate: 300 },
  });

  const payload = data.getPublicVideosForSite;
  const store = payload?.store;
  const users = new Map((store?.users ?? []).map((u) => [u.userId, u]));
  const posts = new Map((store?.posts ?? []).map((p) => [p.postId, p]));
  const videoElements = new Map(
    (store?.mediaElements ?? [])
      .filter((m) => m.mediaType === "video" && m.streamUrl && m.postId)
      .map((m) => [m.postId as string, m]),
  );

  function toSiteVideo(
    postId: string,
    kind: SiteVideo["kind"],
  ): SiteVideo | null {
    const post = posts.get(postId);
    const media = videoElements.get(postId);
    if (!post || !media?.streamUrl) return null;
    const author = post.creatorUserId
      ? users.get(post.creatorUserId)
      : undefined;
    const text = post.postText ?? "";
    return {
      postId,
      kind,
      orientation: kind === "SHORT_FORM" ? "PORTRAIT" : "LANDSCAPE",
      title: post.title?.trim() || firstLine(text) || "Untitled video",
      description: text,
      authorName: author?.displayName ?? null,
      authorUsername: author?.username ?? null,
      publishedDate: post.publishedDate,
      views: post.numUniqueViews ?? 0,
      durationMs: media.duration ?? null,
      previewImageUrl: post.mediaPreviewUrl ?? media.mediaPreviewImageUrl,
      streamUrl: media.streamUrl,
    };
  }

  const longIds = payload?.results?.longVideoPostIds ?? [];
  const shortIds = payload?.results?.shortVideoPostIds ?? [];
  const longVideos = longIds
    .map((id) => toSiteVideo(id, "LONG_FORM"))
    .filter((v): v is SiteVideo => v !== null);
  const shortVideos = shortIds
    .map((id) => toSiteVideo(id, "SHORT_FORM"))
    .filter((v): v is SiteVideo => v !== null);

  return {
    longVideos,
    shortVideos,
    lastLongPostId: longIds.at(-1) ?? null,
    lastShortPostId: shortIds.at(-1) ?? null,
    longHasMore: longCount > 0 && longIds.length >= longCount,
    shortHasMore: shortCount > 0 && shortIds.length >= shortCount,
  };
}
