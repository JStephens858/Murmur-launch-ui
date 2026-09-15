/**
 * Turns a videos response (public or signed-in — both return post ids plus
 * a normalised store) into the card models the videos browser renders.
 * Pure, so the browser bundle can use it for the portal's own fetches.
 */

export interface VideoHashtag {
  hashtagId: string;
  /** Tag text without the leading "#". */
  hashtag: string;
}

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
  hashtags: VideoHashtag[];
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

interface StoreUserLike {
  userId: string;
  displayName: string | null;
  username: string | null;
}
interface StorePostLike {
  postId: string;
  title: string | null;
  postText: string | null;
  creatorUserId: string | null;
  publishedDate: string | null;
  numUniqueViews: number | null;
  mediaPreviewUrl: string | null;
  hashtagIds: string[] | null;
}
interface StoreHashtagLike {
  hashtagId: string;
  hashtag: string | null;
}
interface StoreMediaLike {
  postId: string | null;
  mediaType: string | null;
  duration: number | null;
  streamUrl: string | null;
  mediaPreviewImageUrl: string | null;
}

/** The store fields the mapping reads; both store types satisfy it. */
export interface VideoStoreLike {
  users: (StoreUserLike | null)[] | null;
  posts: (StorePostLike | null)[] | null;
  hashtags: (StoreHashtagLike | null)[] | null;
  mediaElements: (StoreMediaLike | null)[] | null;
}

function present<T>(list: (T | null)[] | null | undefined): T[] {
  return (list ?? []).filter((x): x is T => x !== null);
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim();
}

export function buildVideosPage(
  {
    longIds,
    shortIds,
    store,
  }: {
    longIds: string[];
    shortIds: string[];
    store: VideoStoreLike | null | undefined;
  },
  { longCount, shortCount }: { longCount: number; shortCount: number },
): PublicVideosPage {
  const users = new Map(present(store?.users).map((u) => [u.userId, u]));
  const posts = new Map(present(store?.posts).map((p) => [p.postId, p]));
  const hashtags = new Map(
    present(store?.hashtags)
      .filter((h) => h.hashtag)
      .map((h) => [h.hashtagId, h.hashtag as string]),
  );
  const videoElements = new Map(
    present(store?.mediaElements)
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
    // hashtagIds arrive with heavy duplication — dedupe, preserve order
    const tagList = [...new Set(post.hashtagIds ?? [])]
      .map((id) => {
        const tag = hashtags.get(id);
        return tag ? { hashtagId: id, hashtag: tag } : null;
      })
      .filter((h): h is VideoHashtag => h !== null);
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
      hashtags: tagList,
    };
  }

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
