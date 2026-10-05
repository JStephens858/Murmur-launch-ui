import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import type { MurmurResponse } from "./types";

/**
 * The signed-in physician, as the API sees them. Carries the unread counts
 * the sidebar badges show; the backend counts unseen notifications from
 * the database on every profile load, so refetching this after marking
 * notifications seen is what clears the badge.
 */
export interface CurrentUser {
  userId: string;
  username: string;
  displayName: string | null;
  profilePicThumbnailUrl: string | null;
  numNotifications: number | null;
  numDirectMessages: number | null;
  /** admin | doctor | staff | sponsor | observer | industry | public | HCP | hospitalAdmin */
  userClass: string;
  isAdmin: number;
  isContentCreator: boolean | null;
}

const GET_PROFILE = /* GraphQL */ `
  query getProfile {
    getProfile {
      success
      errorMsg
      errorCode
      results {
        user {
          userId
          username
          displayName
          profilePicThumbnailUrl
          numNotifications
          numDirectMessages
          userClass
          isAdmin
          isContentCreator
        }
      }
    }
  }
`;

interface GetProfileData {
  getProfile: MurmurResponse & {
    results:
      | { user: CurrentUser | null }
      | { user: CurrentUser | null }[]
      | null;
  };
}

export const currentUserKey = ["currentUser"] as const;

export const currentUserOptions = queryOptions({
  queryKey: currentUserKey,
  queryFn: async (): Promise<CurrentUser | null> => {
    const data = await portalQuery<GetProfileData>(GET_PROFILE);
    const res = data.getProfile;
    if (!res.success) {
      throw new PortalApiError(
        res.errorMsg ?? "Couldn't load your profile",
        res.errorCode,
      );
    }
    const results = res.results;
    if (!results) return null;
    return Array.isArray(results) ? (results[0]?.user ?? null) : results.user;
  },
  staleTime: 60_000,
  // The app gets badge updates pushed over a subscription; poll instead.
  refetchInterval: 60_000,
});

export function useCurrentUser() {
  return useQuery(currentUserOptions);
}

/** Re-reads the profile, e.g. after notifications were marked seen. */
export function useRefreshCurrentUser() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: currentUserKey });
}
