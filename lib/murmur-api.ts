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

async function fetchMurmurAPI<T>(
  query: string,
  accessToken: string,
): Promise<T> {
  const endpoint = process.env.MURMUR_API_SERVER;
  if (!endpoint) {
    throw new Error("MURMUR_API_SERVER is not set");
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
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
  const data = await fetchMurmurAPI<GetProfileData>(
    GET_PROFILE_QUERY,
    accessToken,
  );
  const results = data.getProfile?.results;
  if (!results) return null;
  return Array.isArray(results) ? (results[0]?.user ?? null) : results.user;
}
