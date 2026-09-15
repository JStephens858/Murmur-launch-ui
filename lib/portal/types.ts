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

export type PostGroupType =
  | "public"
  | "private"
  | "restricted"
  | "direct_message";

export interface PortalPostGroupCategory {
  categoryId: string;
  order: number;
  key: string;
  name: string;
  subtitle: string | null;
  parentCategoryId: string | null;
  /** header: a tab over the post list; browser: a drill-down of children. */
  categoryDisplayStyle: "header" | "browser";
  hasChildren: number;
  displayStyle: string;
}

/**
 * A post group. The store block of every response carries the first four
 * fields; getAllPostGroups fills in the rest (PostGroupSettingsResults),
 * which is why they're optional. Ints are the API's booleans (> 0).
 */
export interface PortalPostGroup {
  postGroupId: string;
  groupName: string;
  groupType: PostGroupType;
  /** A URL, or a single emoji, or null for the app's logo. */
  iconUrl: string | null;
  description?: string;
  memberCount?: number;
  subscribed?: boolean;
  sponsored?: number;
  sponsor?: string | null;
  /** JSON: { userClass: string[], canRequestAccessUserClass: string[] }. */
  restrictions?: string | null;
  categories?: PortalPostGroupCategory[] | null;
  pinnedPostId?: string | null;
  moderatorUserIds?: string[] | null;
  canPost?: number;
  canLeave?: number;
  canSeeGroupDetails?: number | null;
  onlyModsCanSetCategory?: number;
  isVisibleInList?: number | null;
  numUnseenMessages?: number | null;
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
