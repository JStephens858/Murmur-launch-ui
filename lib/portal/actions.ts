import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import { STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type { MurmurResponse, PortalPost, StoreData } from "./types";

/**
 * Post actions. Like mirrors MurmurAPI.likePost in the app: flip the
 * post's like state and count locally first, then send `like: 1 | 0`, and
 * put things back if the API refuses.
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

interface LikePostData {
  likePost: MurmurResponse & { store: StoreData | null };
}

export function useLikePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, like }: { postId: string; like: boolean }) => {
      const data = await portalQuery<LikePostData>(LIKE_POST, {
        postId,
        like: like ? 1 : 0,
      });
      const res = data.likePost;
      if (!res.success) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't update like",
          res.errorCode,
        );
      }
      ingestStore(client, res.store);
    },
    onMutate: async ({ postId, like }) => {
      const key = entityKey.post(postId);
      const previous = client.getQueryData<PortalPost>(key);
      if (previous) {
        client.setQueryData<PortalPost>(key, {
          ...previous,
          likedByMe: like ? 1 : 0,
          numLikes: Math.max(0, (previous.numLikes ?? 0) + (like ? 1 : -1)),
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
