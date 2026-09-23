import type { MurmurResponse, StoreData } from "./types";

/**
 * The feed is an ordinary post group with a sentinel id; the app's
 * MurmurAPI.FEED_UUID. There is no separate feed operation.
 */
export const FEED_GROUP_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

/**
 * Subset of the app's `contents` fragment (GraphQL/storeFragment.graphql):
 * the fields the web renders, nothing the web ignores. Both queries below
 * return this same store shape; the difference is which related rows the
 * server chooses to include.
 */
export const STORE_FRAGMENT = /* GraphQL */ `
  fragment portalStore on StoreData {
    users {
      userId
      username
      displayName
      isDeleted
      profilePicThumbnailUrl
      profilePicMediumUrl
      coverPicMediumUrl
      specialty
      flair
      location
      bio
      disclosures
      interests
      invitedByUsername
      link
      createdDate
      userClass
      isEmployee
      rank
      score
      progressToNextRank
    }
    mediaElements {
      postId
      mediaElementId
      indexInPost
      mediaType
      mediaText
      mediaUrl
      streamUrl
      duration
      fileSize
      mediaPreviewImageUrl
      attachmentTitle
      attachmentImage
      attachmentDescription
      attachmentDestinationUrl
      properties
      pollResults {
        optionId
        text
        count
        percent
        percentStr
        isWinner
      }
      pollTotalVotesCast
    }
    posts {
      postId
      postGroupId
      rootPostId
      parentPostId
      depth
      isDeleted
      isPublished
      creatorUserId
      createdDate
      publishedDate
      title
      postText
      mediaPreviewUrl
      mediaElementIds
      hashtagIds
      commentIds
      quotedPostId
      numLikes
      numComments
      numBookmarks
      numUniqueViews
      likedByMe
      bookmarkedByMe
      commentsLocked
      categoryKey
      promotedPostType
      baseUserPostScore
      weightedUserPostScore
      baseComputedPostScore
      weightedComputedPostScore
    }
    hashtags {
      hashtagId
      hashtag
    }
    postGroups {
      postGroupId
      groupName
      groupType
      iconUrl
      description
      pinnedPostId
      moderatorUserIds
      sponsored
      sponsor
      restrictions
      onlyModsCanSetCategory
      categories {
        categoryId
        order
        key
        name
        subtitle
        parentCategoryId
        categoryDisplayStyle
        hasChildren
        displayStyle
      }
    }
  }
`;

/**
 * One page of a group's posts. The cursor is the last post id received plus
 * the server-echoed requestDate, which pins the window so posts published
 * mid-scroll don't shift the pages (mirrors PostListView / MurmurAPI in the
 * app). Post rows come back complete but their media elements, comments and
 * quoted posts do not — only a mediaPreviewUrl thumbnail.
 */
export const GET_POSTS_IN_GROUP = /* GraphQL */ `
  query getPostsInGroup(
    $postGroupId: ID!
    $categoryIds: [ID!]
    $count: Int!
    $requestDate: DateTimeTz
    $lastPostIdReceived: String
  ) {
    getPostsInGroup(
      postGroupId: $postGroupId
      categoryIds: $categoryIds
      count: $count
      requestDate: $requestDate
      lastPostIdReceived: $lastPostIdReceived
    ) {
      success
      errorMsg
      errorCode
      requestDate
      endOfList
      results {
        postIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

export interface GetPostsInGroupData {
  getPostsInGroup: MurmurResponse & {
    requestDate: string;
    endOfList: boolean;
    results: { postIds: (string | null)[] } | null;
    store: StoreData | null;
  };
}

/**
 * Everything for one post: all media elements, the comment posts and any
 * quoted post land in the store. What the app calls before pushing detail.
 */
export const GET_FULL_POST_DATA = /* GraphQL */ `
  query getFullPostData($postIds: [ID!]!) {
    getFullPostData(postIds: $postIds) {
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

export interface GetFullPostDataData {
  getFullPostData: MurmurResponse & { store: StoreData | null };
}
