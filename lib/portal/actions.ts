import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type { MurmurResponse, PortalPost, StoreData } from "./types";

/**
 * Post marks: like and bookmark. They are the same shape at both ends. The
 * app's MurmurAPI.likePost and bookmarkPost flip the flag locally and send
 * `1 | 0`; the backend routes both through markPost and answers with a store
 * carrying the post's new counts. So one hook does both: flip the flag and
 * count optimistically, send, ingest the store, and put things back if the
 * API refuses.
 */

const LIKE_POST = /* GraphQL */ `
  mutation likePost($postId: ID!, $like: Int) {
    likePost(postId: $postId, like: $like) {
      success
      errorMsg
      errorCode
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

const BOOKMARK_POST = /* GraphQL */ `
  mutation bookmarkPost($postId: ID!, $bookmark: Int) {
    bookmarkPost(postId: $postId, bookmark: $bookmark) {
      success
      errorMsg
      errorCode
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

type MarkResponse = MurmurResponse & { store: StoreData | null };

interface Mark {
  mutation: string;
  /** The operation's name in the response. */
  field: "likePost" | "bookmarkPost";
  /** The `1 | 0` variable's name. */
  variable: "like" | "bookmark";
  flag: "likedByMe" | "bookmarkedByMe";
  count: "numLikes" | "numBookmarks";
  failureMessage: string;
}

const LIKE: Mark = {
  mutation: LIKE_POST,
  field: "likePost",
  variable: "like",
  flag: "likedByMe",
  count: "numLikes",
  failureMessage: "Couldn't update like",
};

const BOOKMARK: Mark = {
  mutation: BOOKMARK_POST,
  field: "bookmarkPost",
  variable: "bookmark",
  flag: "bookmarkedByMe",
  count: "numBookmarks",
  failureMessage: "Couldn't update bookmark",
};

function useMarkPost(mark: Mark) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, on }: { postId: string; on: boolean }) => {
      const data = await portalQuery<Record<Mark["field"], MarkResponse>>(
        mark.mutation,
        { postId, [mark.variable]: on ? 1 : 0 },
      );
      const res = data[mark.field];
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? mark.failureMessage,
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
    },
    onMutate: async ({ postId, on }) => {
      const key = entityKey.post(postId);
      const previous = client.getQueryData<PortalPost>(key);
      if (previous) {
        client.setQueryData<PortalPost>(key, {
          ...previous,
          [mark.flag]: on ? 1 : 0,
          [mark.count]: Math.max(
            0,
            (previous[mark.count] ?? 0) + (on ? 1 : -1),
          ),
        });
      }
      return { previous };
    },
    onError: (_error, { postId }, context) => {
      if (context?.previous) {
        client.setQueryData(entityKey.post(postId), context.previous);
      }
    },
  });
}

/** `mutate({ postId, on })` — `on` is the state to move to, not a toggle. */
export function useLikePost() {
  return useMarkPost(LIKE);
}

export function useBookmarkPost() {
  return useMarkPost(BOOKMARK);
}
