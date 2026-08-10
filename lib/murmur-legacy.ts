/**
 * GraphQL operations behind the legacy endpoints ported from Murmur-express's
 * staticServer.js. Transcribed from that file — the mutation names, variables
 * and enum spellings must match what the API has been receiving for years.
 *
 * Two service identities, kept separate because the backend attributes these
 * mutations to whichever one calls them:
 *   MURMUR_SERVICE_AUTH_TOKEN      (legacy AUTH_TOKEN, the fileUploadHandler
 *                                   user) — invite linkage, reengagement,
 *                                   admin flag
 *   MURMUR_HEALTH_CHECK_AUTH_TOKEN (legacy HEALTH_CHECK_AUTH_TOKEN, the
 *                                   healthCheck user) — email verification,
 *                                   health check
 *
 * Legacy sent these tokens as a bare `authorization` header with no scheme;
 * fetchMurmurAPI sends `Bearer <token>`. Both work — Murmur-apollo's
 * index.js:719 strips a "Bearer " prefix if present.
 */

import { fetchMurmurAPI } from "./murmur-api";

function serviceToken(): string {
  const token = process.env.MURMUR_SERVICE_AUTH_TOKEN;
  if (!token) throw new Error("MURMUR_SERVICE_AUTH_TOKEN is not set");
  return token;
}

function healthCheckToken(): string {
  const token = process.env.MURMUR_HEALTH_CHECK_AUTH_TOKEN;
  if (!token) throw new Error("MURMUR_HEALTH_CHECK_AUTH_TOKEN is not set");
  return token;
}

/** Wall-clock budget for a mutation whose result gates the rendered page. */
export function mutationTimeoutMs(): number {
  return Number(process.env.MURMUR_LEGACY_MUTATION_TIMEOUT_MS) || 2500;
}

/* ── Invite → IP attribution ──────────────────────────────────────────────── */

interface CreateIPInviteLinkageData {
  createIPInviteLinkage: { success: boolean | null } | null;
}

const CREATE_IP_INVITE_LINKAGE = /* GraphQL */ `
  mutation createIPInviteLinkage(
    $ip: String
    $inviteCode: String
    $viewOrClick: String
  ) {
    createIPInviteLinkage(
      ip: $ip
      inviteCode: $inviteCode
      viewOrClick: $viewOrClick
    ) {
      success
    }
  }
`;

/**
 * Attribution telemetry for invite landings. `ip` is the raw X-Forwarded-For
 * header value, passed through unchanged so the stored strings stay consistent
 * with everything already in the table.
 */
export async function createIPInviteLinkage(
  ip: string | null,
  inviteCode: string,
  viewOrClick: "view" | "click",
): Promise<boolean> {
  const data = await fetchMurmurAPI<CreateIPInviteLinkageData>(
    CREATE_IP_INVITE_LINKAGE,
    {
      accessToken: serviceToken(),
      variables: { ip, inviteCode, viewOrClick },
    },
  );
  return data.createIPInviteLinkage?.success === true;
}

/* ── Reengagement: accept posts ───────────────────────────────────────────── */

interface AcceptReengagementData {
  webBasedAcceptReengagementPosts: { success: boolean | null } | null;
}

const ACCEPT_REENGAGEMENT_POSTS = /* GraphQL */ `
  mutation webBasedAcceptReengagementPosts($dateStr: String!, $username: String!) {
    webBasedAcceptReengagementPosts(dateStr: $dateStr, username: $username) {
      success
    }
  }
`;

export async function webBasedAcceptReengagementPosts(
  dateStr: string,
  username: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await fetchMurmurAPI<AcceptReengagementData>(
    ACCEPT_REENGAGEMENT_POSTS,
    {
      accessToken: serviceToken(),
      variables: { dateStr, username },
      signal,
    },
  );
  return data.webBasedAcceptReengagementPosts?.success === true;
}

/* ── Admin flag: doNotPromote ─────────────────────────────────────────────── */

interface AdminFlagSetData {
  webBasedAdminFlagSet: { success: boolean | null } | null;
}

const ADMIN_FLAG_SET = /* GraphQL */ `
  mutation webBasedAdminFlagSet(
    $postId: ID!
    $magicCookie: String!
    $username: String!
    $flag: PostCategoryFlag!
  ) {
    webBasedAdminFlagSet(
      postId: $postId
      magicCookie: $magicCookie
      username: $username
      flag: $flag
    ) {
      success
    }
  }
`;

/**
 * Sets the `doNotPromote` category flag. The flag is passed as a string
 * variable and coerced to the PostCategoryFlag enum server-side, exactly as
 * legacy did.
 */
export async function webBasedAdminFlagSetDoNotPromote(
  postId: string,
  magicCookie: string,
  username: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await fetchMurmurAPI<AdminFlagSetData>(ADMIN_FLAG_SET, {
    accessToken: serviceToken(),
    variables: { postId, magicCookie, username, flag: "doNotPromote" },
    signal,
  });
  return data.webBasedAdminFlagSet?.success === true;
}

/* ── Email verification ───────────────────────────────────────────────────── */

interface AdminVerifyEmailData {
  adminVerifyEmail: { success: boolean | null } | null;
}

const ADMIN_VERIFY_EMAIL = /* GraphQL */ `
  mutation adminVerifyEmail($userId: ID!, $emailId: ID!) {
    adminVerifyEmail(userId: $userId, emailId: $emailId) {
      success
    }
  }
`;

export async function adminVerifyEmail(
  userId: string,
  emailId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await fetchMurmurAPI<AdminVerifyEmailData>(ADMIN_VERIFY_EMAIL, {
    accessToken: healthCheckToken(),
    variables: { userId, emailId },
    signal,
  });
  return data.adminVerifyEmail?.success === true;
}

/* ── Public post data (for /post/<postId>?mc=…) ───────────────────────────── */

export interface PublicPollResult {
  id: string;
  text: string;
  count: number | null;
  percentStr: string | null;
  isWinner: number | null;
}

export interface PublicMediaElement {
  mediaElementId: string;
  /** "text" | "image" | "video" | "poll" | "file" — string in the schema. */
  mediaType: string;
  mediaText: string;
  indexInPost: number;
  mediaUrl: string | null;
  /** HLS manifest for videos; feed to the existing VideoPlayer. */
  streamUrl: string | null;
  mediaPreviewImageUrl: string | null;
  pollVotesCast: number | null;
  pollResults: PublicPollResult[] | null;
  filename: string | null;
}

export interface PublicPost {
  /**
   * Which of three shapes came back:
   *  "full" — the `mc` matched the post's magic cookie: everything, media included.
   *  "og"   — no or wrong `mc`. The backend calls this "used for opengraph only":
   *           postText truncated to 100 chars, a preview image and a username,
   *           no media, and a `createdDate` of *now* rather than the real one.
   *  "none" — no such published post.
   */
  resultType: "full" | "og" | "none";
  postId: string;
  postText: string;
  postGroupName: string;
  createdDate: string;
  mediaPreviewUrl: string | null;
  creator: {
    userId: string;
    username: string;
    displayName: string;
    profilePicThumbnailUrl: string;
  };
  mediaElements: PublicMediaElement[];
}

const GET_PUBLIC_POST_DATA = /* GraphQL */ `
  query getPublicPostData($postId: ID!, $mc: String) {
    getPublicPostData(postId: $postId, mc: $mc) {
      resultType
      postId
      postText
      postGroupName
      createdDate
      mediaPreviewUrl
      creator {
        userId
        username
        displayName
        profilePicThumbnailUrl
      }
      mediaElements {
        mediaElementId
        mediaType
        mediaText
        indexInPost
        mediaUrl
        streamUrl
        mediaPreviewImageUrl
        pollVotesCast
        pollResults {
          id
          text
          count
          percentStr
          isWinner
        }
      }
    }
  }
`;

/**
 * Ported from Murmur-express/queries/GET_PUBLIC_POST_DATA.js, with `resultType`
 * added — legacy inferred the same thing from whether postId came back non-empty,
 * but the field states it directly.
 *
 * `filename` is available on media elements too but not requested: the only use
 * would be offering a download of a "file" element, and these pages are for
 * people who don't have the app yet.
 *
 * Never cached: `mc` is an access-granting cookie, so a cached render could serve
 * one visitor's gated view to another.
 */
export async function getPublicPostData(
  postId: string,
  mc: string | null,
  signal?: AbortSignal,
): Promise<PublicPost | null> {
  const data = await fetchMurmurAPI<{
    getPublicPostData: PublicPost | null;
  }>(GET_PUBLIC_POST_DATA, {
    accessToken: healthCheckToken(),
    variables: { postId, mc },
    signal,
  });
  return data.getPublicPostData ?? null;
}

/* ── Health check ─────────────────────────────────────────────────────────── */

interface HealthCheckData {
  healthCheck: { success: boolean | null } | null;
}

const HEALTH_CHECK = /* GraphQL */ `
  query healthCheck($service: String) {
    healthCheck(service: $service) {
      success
    }
  }
`;

export async function healthCheck(
  service: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await fetchMurmurAPI<HealthCheckData>(HEALTH_CHECK, {
    accessToken: healthCheckToken(),
    variables: { service },
    signal,
  });
  return data.healthCheck?.success === true;
}
