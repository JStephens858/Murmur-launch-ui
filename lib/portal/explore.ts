import {
  type QueryClient,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import { toApiDate } from "./notifications";
import { STORE_FRAGMENT } from "./queries";
import { ingestStore } from "./store";
import type { MurmurResponse, PortalPost, StoreData } from "./types";

/**
 * The Explore tab's post lists: the app's getExplorePostsForUser, which is
 * really two queries behind one name (MurmurAPI.getExplorePostsForUser and
 * the backend's getExplorePostsForUser / _HashtagsAndInterests).
 *
 * - Cases, Polls and Tips & Tricks ask for one *section* of the user's
 *   nightly-computed explore list (`exploreSectionCounts`), paged by the
 *   last post id received in that section (`afterPostId`). The app's
 *   ExploreView2 asks for all three at once (4, 4 and 10); here each tab
 *   asks for its own, 10 at a time.
 * - All posts, and any hashtag, go down the score path: no sections, and
 *   `maximumScore` / `maximumDate` say how far down the ranking the reader
 *   has got. The backend orders "All posts" by baseUserPostScore (the post
 *   score weighted by the reader's interest in its hashtags) and a hashtag
 *   list by baseComputedPostScore, and each page comes back with those
 *   scores on its posts, so the next cursor is the lowest score on the page
 *   and the oldest date among posts with that score. The app computes this
 *   cursor too (ExplorePostListModel.lowestScoreAndDate) but its
 *   fetchMorePosts is commented out, so it only ever shows the first page.
 */

export type ExploreChoice = "all" | "case" | "poll" | "tipsAndTricks";

export const EXPLORE_CHOICES: { value: ExploreChoice; label: string }[] = [
  { value: "all", label: "All posts" },
  { value: "case", label: "Cases" },
  { value: "poll", label: "Polls" },
  { value: "tipsAndTricks", label: "Tips & Tricks" },
];

export const EXPLORE_PAGE_SIZE = 10;

const GET_EXPLORE_POSTS_FOR_USER = /* GraphQL */ `
  query getExplorePostsForUser(
    $resetList: Boolean
    $count: Int
    $hashtagIds: [ID!]
    $exploreSectionCounts: [ExploreSectionCount!]
    $maximumScore: Int
    $maximumDate: DateTimeTz
  ) {
    getExplorePostsForUser(
      resetList: $resetList
      count: $count
      hashtagIds: $hashtagIds
      exploreSectionCounts: $exploreSectionCounts
      maximumScore: $maximumScore
      maximumDate: $maximumDate
    ) {
      success
      errorMsg
      errorCode
      results {
        postIdsBySection {
          exploreSection
          postIds
        }
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface GetExplorePostsForUserData {
  getExplorePostsForUser: MurmurResponse & {
    results: {
      postIdsBySection: {
        exploreSection: string;
        postIds: (string | null)[];
      }[];
    } | null;
    store: StoreData | null;
  };
}

/** Where the next page starts; which shape depends on the list. */
type ExploreCursor =
  | {
      afterPostId: string;
      /** Most posts that can still remain in the section (Infinity if unknown). */
      remainingMax: number;
    }
  | { maximumScore: number; maximumDate: string };

export interface ExplorePage {
  postIds: string[];
  next: ExploreCursor | null;
}

/** The backend's largest allowed score; what the app sends for page one. */
const MAX_SCORE = 2147483647;

/**
 * The score cursor for the page just received: the lowest of the relevant
 * score across its posts, and the oldest date among the posts that share it
 * (the backend's tie-break), as ExplorePostListModel.lowestScoreAndDate does.
 */
function scoreCursor(
  posts: PortalPost[],
  score: (p: PortalPost) => number | null | undefined,
): ExploreCursor | null {
  let lowest = Infinity;
  let oldest = Infinity;
  for (const p of posts) {
    const s = score(p);
    if (s == null) continue;
    const date = new Date(p.createdDate).getTime();
    if (s < lowest || (s === lowest && date < oldest)) {
      lowest = s;
      oldest = date;
    }
  }
  if (lowest === Infinity) return null;
  return { maximumScore: lowest, maximumDate: toApiDate(new Date(oldest)) };
}

/**
 * One section page. The backend has no end-of-list signal for sections and
 * throws when asked for more posts than remain in the user's precomputed
 * list, whether that is page one of a short section or the tail of a long
 * one. So a failed request is retried with half the count until it fits,
 * and each failure narrows the known bound on what remains, so the pages
 * after it ask only for what can exist; at count 1 a failure, or a bound of
 * zero, means the list is exhausted.
 */
async function fetchSectionPage(
  client: QueryClient,
  section: Exclude<ExploreChoice, "all">,
  cursor: ExploreCursor | null,
): Promise<ExplorePage> {
  const prev = cursor && "afterPostId" in cursor ? cursor : null;
  const afterPostId = prev?.afterPostId ?? null;
  let remainingMax = prev?.remainingMax ?? Infinity;
  let count = Math.min(EXPLORE_PAGE_SIZE, remainingMax);
  for (;;) {
    let data: GetExplorePostsForUserData;
    try {
      data = await portalQuery<GetExplorePostsForUserData>(
        GET_EXPLORE_POSTS_FOR_USER,
        {
          resetList: !cursor,
          exploreSectionCounts: [
            { exploreSection: section, count, afterPostId },
          ],
        },
      );
    } catch (error) {
      if (!(error instanceof PortalApiError)) throw error;
      if (count === 1) return { postIds: [], next: null };
      remainingMax = Math.min(remainingMax, count - 1);
      count = Math.floor(count / 2);
      continue;
    }
    const res = data.getExplorePostsForUser;
    if (!res.success) {
      throw new PortalApiError(
        res.errorMsg ?? "Couldn't load posts",
        res.errorCode,
      );
    }
    ingestStore(client, res.store);
    const found = res.results?.postIdsBySection.find(
      (s) => s.exploreSection === section,
    );
    const postIds = (found?.postIds ?? []).filter(
      (id): id is string => typeof id === "string",
    );
    const last = postIds.at(-1);
    remainingMax -= postIds.length;
    const next =
      last && remainingMax > 0 ? { afterPostId: last, remainingMax } : null;
    return { postIds, next };
  }
}

/**
 * One page of the score-ranked list: everything the reader might like, or
 * everything with one hashtag. A short page means the ranking ran out.
 */
async function fetchScoredPage(
  client: QueryClient,
  hashtagId: string | null,
  cursor: ExploreCursor | null,
): Promise<ExplorePage> {
  const scored = cursor && "maximumScore" in cursor ? cursor : null;
  const data = await portalQuery<GetExplorePostsForUserData>(
    GET_EXPLORE_POSTS_FOR_USER,
    {
      resetList: !cursor,
      count: EXPLORE_PAGE_SIZE,
      hashtagIds: hashtagId ? [hashtagId] : null,
      maximumScore: scored?.maximumScore ?? MAX_SCORE,
      maximumDate: scored?.maximumDate ?? toApiDate(new Date()),
    },
  );
  const res = data.getExplorePostsForUser;
  if (!res.success) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't load posts",
      res.errorCode,
    );
  }
  ingestStore(client, res.store);
  const postIds = (res.results?.postIdsBySection[0]?.postIds ?? []).filter(
    (id): id is string => typeof id === "string",
  );
  let next: ExploreCursor | null = null;
  if (postIds.length >= EXPLORE_PAGE_SIZE) {
    const posts = (res.store?.posts ?? []).filter(
      (p): p is PortalPost => p != null && postIds.includes(p.postId),
    );
    next = scoreCursor(posts, (p) =>
      hashtagId ? p.baseComputedPostScore : p.baseUserPostScore,
    );
  }
  return { postIds, next };
}

function fetchExplorePage(
  client: QueryClient,
  choice: ExploreChoice,
  hashtagId: string | null,
  cursor: ExploreCursor | null,
): Promise<ExplorePage> {
  return choice !== "all" && !hashtagId
    ? fetchSectionPage(client, choice, cursor)
    : fetchScoredPage(client, hashtagId, cursor);
}

export function exploreListKey(
  choice: ExploreChoice,
  hashtagId: string | null,
) {
  return ["explore", choice, hashtagId ?? ""] as const;
}

export function useExplorePosts(
  choice: ExploreChoice,
  hashtagId: string | null,
) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: exploreListKey(choice, hashtagId),
    initialPageParam: null as ExploreCursor | null,
    queryFn: ({ pageParam }) =>
      fetchExplorePage(client, choice, hashtagId, pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: 5 * 60_000,
  });
}
