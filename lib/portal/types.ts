/**
 * The slice of the Murmur GraphQL schema the portal reads. Every list
 * response carries a normalised `store` (users, posts, media elements,
 * hashtags, post groups) and the results reference it by id, exactly as the
 * iOS app consumes it. Field names match the schema verbatim.
 */

export type MediaType = "text" | "image" | "video" | "poll" | "file";

export interface PortalUser {
  userId: string;
  username: string;
  displayName: string;
  isDeleted: boolean;
  profilePicThumbnailUrl: string | null;
  profilePicMediumUrl: string | null;
  specialty: string | null;
  flair: string | null;
  location: string | null;
}

export interface PortalPost {
  postId: string;
  postGroupId: string;
  rootPostId: string | null;
  parentPostId: string | null;
  depth: number | null;
  isDeleted: boolean | null;
  isPublished: boolean | null;
  creatorUserId: string;
  createdDate: string;
  publishedDate: string | null;
  title: string | null;
  postText: string | null;
  mediaPreviewUrl: string | null;
  mediaElementIds: string[];
  hashtagIds: string[] | null;
  commentIds: (string | null)[];
  quotedPostId: string | null;
  numLikes: number | null;
  numComments: number | null;
  numBookmarks: number | null;
  numUniqueViews: number | null;
  likedByMe: number | null;
  bookmarkedByMe: number | null;
  commentsLocked: number;
  categoryKey: string | null;
  promotedPostType: string | null;
}

export interface PortalPollOption {
  optionId: string;
  text: string;
  count: number;
  percent: number;
  percentStr: string;
  isWinner: boolean | null;
}

export interface PortalMediaElement {
  postId: string | null;
  mediaElementId: string;
  indexInPost: number | null;
  mediaType: MediaType;
  mediaText: string | null;
  mediaUrl: string | null;
  streamUrl: string | null;
  duration: number | null;
  fileSize: number | string | null;
  mediaPreviewImageUrl: string | null;
  attachmentTitle: string | null;
  attachmentImage: string | null;
  attachmentDescription: string | null;
  attachmentDestinationUrl: string | null;
  /** JSON; for polls, the option list — see lib/portal/polls.ts. */
  properties: string | null;
  pollResults: PortalPollOption[] | null;
  pollTotalVotesCast: number | null;
}

export interface PortalHashtag {
  hashtagId: string;
  hashtag: string;
}

export interface PortalPostGroup {
  postGroupId: string;
  groupName: string;
  groupType: string;
  iconUrl: string | null;
}

export interface StoreData {
  users: (PortalUser | null)[] | null;
  mediaElements: (PortalMediaElement | null)[] | null;
  posts: (PortalPost | null)[] | null;
  hashtags: PortalHashtag[] | null;
  postGroups: PortalPostGroup[] | null;
}

/** Every Murmur response has this envelope; success:false carries the error. */
export interface MurmurResponse {
  success: boolean;
  errorMsg: string | null;
  errorCode: number | null;
}
