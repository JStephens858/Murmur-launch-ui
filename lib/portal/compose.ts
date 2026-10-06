import { useQuery, useQueryClient } from "@tanstack/react-query";
import SparkMD5 from "spark-md5";

import { PortalApiError, portalQuery } from "./graphql";
import { FEED_GROUP_ID, STORE_FRAGMENT } from "./queries";
import { ingestStore } from "./store";
import type {
  MurmurResponse,
  PortalMediaElement,
  PortalPost,
  StoreData,
} from "./types";

/**
 * Creating a post, as the app's PostCreationView / PostCreationModel do it.
 *
 * A post is an ordered list of items (text, image, video, file, poll) under
 * one group. Publishing is a single `createPost` carrying one media element
 * per item; elements with a file name a `fileKey` from `getUploadFileUrls`.
 * The bytes go up by tus only after createPost succeeds, and the server
 * holds the post unpublished until every upload lands (lib/portal/uploads.ts
 * takes it from there). Hashtags and @mentions are plain text the server
 * parses out of `mediaText`; there is nothing to create for them.
 *
 * The app enforces no length or count limits, so neither does this.
 */

/* ── The draft model ─────────────────────────────────────────────────── */

export interface LinkPreview {
  url: string;
  title: string | null;
  image: string | null;
  description: string | null;
  baseUrl: string | null;
  destination: string | null;
}

interface ItemBase {
  /** Client-made lowercase UUID; becomes the element's mediaElementId. */
  id: string;
  /**
   * Set on items loaded from a post being edited: the element already
   * exists, so it's sent without a file key and its media can't change.
   */
  uploaded?: {
    previewUrl: string | null;
  };
}

export interface TextItem extends ItemBase {
  kind: "text";
  text: string;
  /** Moderators can make one text item the title (sent at indexInPost -1). */
  isTitle?: boolean;
  link?: LinkPreview | null;
  /** A preview the author closed; not looked up again for this URL. */
  dismissedLink?: string | null;
}

export interface ImageItem extends ItemBase {
  kind: "image";
  caption: string;
  file: Blob | null;
}

export interface VideoItem extends ItemBase {
  kind: "video";
  caption: string;
  file: Blob | null;
  /** 0–1 through the video; the server cuts the poster frame there. */
  posterPercent: number;
}

export interface FileItem extends ItemBase {
  kind: "file";
  caption: string;
  file: Blob | null;
  filename: string;
  allowDownload: boolean;
}

export interface PollItem extends ItemBase {
  kind: "poll";
  prompt: string;
  options: { id: string; text: string }[];
}

export type ComposeItem =
  | TextItem
  | ImageItem
  | VideoItem
  | FileItem
  | PollItem;
export type ComposeItemKind = ComposeItem["kind"];

export type ComposeMode =
  | { type: "new" }
  | { type: "quote"; quotedPostId: string }
  | {
      type: "edit";
      postId: string;
      /** Kept as they were: an edited comment stays a comment, a quote a quote. */
      parentPostId: string | null;
      quotedPostId: string | null;
      /** Once a post has replies it can't move to another group. */
      lockedToGroup: boolean;
    };

export interface ComposeDraft {
  mode: ComposeMode;
  /** FEED_GROUP_ID until the author picks a group. */
  postGroupId: string;
  categoryKey: string | null;
  additionalCategoryKeys: string[];
  anonymous: boolean;
  /** Admin "Post as". */
  postAsUserId: string | null;
  /** Moderator "Clone a post"; a clone has no items of its own. */
  clonedPostId: string | null;
  sponsorshipBountyId: string | null;
  items: ComposeItem[];
  updatedAt: number;
}

/**
 * A lowercase v4 UUID. Built on getRandomValues rather than randomUUID,
 * which browsers only provide on secure origins: a phone loading the dev
 * server over http://<LAN IP> doesn't have it.
 */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newItem(kind: "text" | "poll"): ComposeItem {
  return kind === "text"
    ? { kind: "text", id: uuid(), text: "" }
    : {
        kind: "poll",
        id: uuid(),
        prompt: "",
        options: [
          { id: uuid(), text: "" },
          { id: uuid(), text: "" },
        ],
      };
}

/** An item for a picked file: photos and videos by type, anything else a file. */
export function itemForFile(file: File, asAttachment = false): ComposeItem {
  if (!asAttachment && file.type.startsWith("image/")) {
    return { kind: "image", id: uuid(), caption: "", file };
  }
  if (!asAttachment && file.type.startsWith("video/")) {
    return { kind: "video", id: uuid(), caption: "", file, posterPercent: 0 };
  }
  return {
    kind: "file",
    id: uuid(),
    caption: "",
    file,
    filename: file.name,
    allowDownload: true,
  };
}

export function emptyDraft(
  mode: ComposeMode = { type: "new" },
  postGroupId = FEED_GROUP_ID,
): ComposeDraft {
  return {
    mode,
    postGroupId,
    categoryKey: null,
    additionalCategoryKeys: [],
    anonymous: false,
    postAsUserId: null,
    clonedPostId: null,
    sponsorshipBountyId: null,
    items: [newItem("text")],
    updatedAt: Date.now(),
  };
}

/** The file types the app's document picker accepts. */
export const ATTACHMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.key";

/* ── Validation (PostCreationModel.cleanUpPost / isPostComplete) ───────── */

/** Drops blank poll options and empty text items, as the app does before posting. */
export function cleanUp(draft: ComposeDraft): ComposeDraft {
  return {
    ...draft,
    items: draft.items
      .filter((i) => i.kind !== "text" || i.text.trim() !== "")
      .map((i) =>
        i.kind === "poll"
          ? { ...i, options: i.options.filter((o) => o.text.trim() !== "") }
          : i,
      ),
  };
}

/** The app's error for an unpostable draft, or null when it can go. */
export function postProblem(draft: ComposeDraft): string | null {
  if (draft.postGroupId === FEED_GROUP_ID) {
    return "You need to choose a group to post to.";
  }
  const hasContent =
    draft.items.some(
      (i) =>
        (i.kind === "text" && i.text.trim() !== "") ||
        ((i.kind === "image" || i.kind === "video" || i.kind === "file") &&
          (i.file || i.uploaded)) ||
        i.kind === "poll",
    ) ||
    draft.mode.type === "quote" ||
    (draft.mode.type === "edit" && !!draft.mode.quotedPostId) ||
    !!draft.clonedPostId;
  if (!hasContent) return "This post looks empty.";
  const incomplete = draft.items.some(
    (i) =>
      (i.kind === "poll" &&
        (i.prompt.trim() === "" ||
          !i.options.some((o) => o.text.trim() !== ""))) ||
      (i.kind === "text" && i.text.trim() === ""),
  );
  if (incomplete) {
    return "Some items in your post are empty or incomplete. Fill them in or remove them.";
  }
  return null;
}

/* ── Preparing files ───────────────────────────────────────────────────── */

/** The app's image export: JPEG at quality 0.7, at most 2100 px on the long edge. */
const IMAGE_MAX_EDGE = 2100;
const JPEG_QUALITY = 0.7;
/** File thumbnails are rendered at most 1200 px square. */
const THUMB_MAX_EDGE = 1200;

async function toJpeg(file: Blob, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image");
  // JPEG has no alpha; transparent PNGs would otherwise turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't encode the image")),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}

/** Lowercase hex MD5 of a blob, read in slices so a long video isn't held twice. */
async function md5(blob: Blob): Promise<string> {
  const SLICE = 8 * 1024 * 1024;
  const spark = new SparkMD5.ArrayBuffer();
  for (let at = 0; at < blob.size; at += SLICE) {
    spark.append(await blob.slice(at, at + SLICE).arrayBuffer());
  }
  return spark.end();
}

/** MIME type for an attachment; browsers leave some (e.g. .key) blank. */
function attachmentType(item: FileItem): string {
  if (item.file?.type) return item.file.type;
  const ext = item.filename.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    key: "application/vnd.apple.keynote",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return (ext && byExt[ext]) || "application/octet-stream";
}

/* ── API: upload slots and createPost ─────────────────────────────────── */

type UploadType = "postImage" | "postVideo" | "postFile" | "postPreviewImage";

interface UploadRequest {
  contentType: string;
  uploadType: UploadType;
  size: number;
  md5Sum: string;
  originalFilename?: string;
  previewImagePercent?: number;
}

interface UploadSlot {
  uploadType: UploadType;
  uploadFileUrl: string;
  fileKey: string;
}

const GET_UPLOAD_FILE_URLS = /* GraphQL */ `
  query getUploadFileUrls($requests: [UploadFileUrlIn]) {
    getUploadFileUrls(requests: $requests) {
      success
      errorMsg
      errorCode
      results {
        fileUrls {
          uploadType
          uploadFileUrl
          fileKey
        }
      }
    }
  }
`;

async function getUploadSlots(
  requests: UploadRequest[],
): Promise<UploadSlot[]> {
  const data = await portalQuery<{
    getUploadFileUrls: MurmurResponse & {
      results: { fileUrls: UploadSlot[] } | null;
    };
  }>(GET_UPLOAD_FILE_URLS, { requests });
  const res = data.getUploadFileUrls;
  if (!res.success || !res.results) {
    throw new PortalApiError(
      res.errorMsg ?? "Couldn't start the upload",
      res.errorCode,
    );
  }
  return res.results.fileUrls;
}

const CREATE_POST = /* GraphQL */ `
  mutation createPost(
    $parentPostId: ID
    $postGroupId: ID
    $categoryKey: String
    $additionalCloneCategoryKeys: [String]
    $isEditingPost: ID
    $quotedPostId: ID
    $clonedPostId: ID
    $mediaElements: [UploadedMediaElements]
    $anonymous: Boolean
    $anonymousPostToken: String
    $postAsUserId: ID
    $sponsorshipBountyId: ID
  ) {
    createPost(
      parentPostId: $parentPostId
      postGroupId: $postGroupId
      categoryKey: $categoryKey
      additionalCloneCategoryKeys: $additionalCloneCategoryKeys
      isEditingPost: $isEditingPost
      mediaElements: $mediaElements
      quotedPostId: $quotedPostId
      clonedPostId: $clonedPostId
      anonymous: $anonymous
      anonymousPostToken: $anonymousPostToken
      postAsUserId: $postAsUserId
      sponsorshipBountyId: $sponsorshipBountyId
    ) {
      success
      errorMsg
      errorCode
      anonymousPostToken
      results {
        postId
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface CreatePostData {
  createPost: MurmurResponse & {
    anonymousPostToken: string | null;
    results: { postId: string } | null;
    store: StoreData | null;
  };
}

/** UploadedMediaElements, as the app fills it. */
interface MediaElementIn {
  mediaElementId: string;
  indexInPost: number;
  mediaType: ComposeItemKind;
  mediaText: string | null;
  fileKey?: string | null;
  previewImageFileKey?: string | null;
  properties?: string | null;
  attachmentTitle?: string | null;
  attachmentImage?: string | null;
  attachmentDescription?: string | null;
  attachmentBaseUrl?: string | null;
  attachmentDestinationUrl?: string | null;
}

/** One tus upload to run once the post exists. */
export interface PendingUpload {
  mediaElementId: string;
  fileKey: string;
  uploadFileUrl: string;
  blob: Blob;
  contentType: string;
  filename: string;
}

/**
 * The anonymous token createPost hands back, kept per post: editing an
 * anonymous post later has to present it. The app keeps it in local storage
 * too, so it only works from the browser that made the post.
 */
const ANON_TOKENS = "murmur.anonymousPostTokens";

export function anonymousPostToken(postId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(ANON_TOKENS) ?? "{}");
    return typeof all[postId] === "string" ? all[postId] : null;
  } catch {
    return null;
  }
}

function rememberAnonymousPostToken(postId: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(ANON_TOKENS) ?? "{}");
    all[postId] = token;
    localStorage.setItem(ANON_TOKENS, JSON.stringify(all));
  } catch {
    /* storage unavailable; the post is still made */
  }
}

export interface SubmitResult {
  postId: string;
  post: PortalPost | null;
  uploads: PendingUpload[];
}

/**
 * Sends a (cleaned, validated) draft: prepares and fingerprints each new
 * file, asks for upload slots, then calls createPost. Returns the uploads
 * still to run; nothing has been uploaded yet.
 */
export async function submitDraft(
  client: ReturnType<typeof useQueryClient>,
  draft: ComposeDraft,
  onStage?: (stage: string) => void,
): Promise<SubmitResult> {
  type Prepared = {
    item: ComposeItem;
    blob?: Blob;
    contentType?: string;
    request?: UploadRequest;
    thumb?: { blob: Blob; request: UploadRequest };
  };
  const prepared: Prepared[] = [];
  onStage?.("Preparing media…");
  for (const item of draft.items) {
    if (
      (item.kind === "image" ||
        item.kind === "video" ||
        item.kind === "file") &&
      item.file &&
      !item.uploaded
    ) {
      if (item.kind === "image") {
        const blob = await toJpeg(item.file, IMAGE_MAX_EDGE);
        prepared.push({
          item,
          blob,
          contentType: "image/jpeg",
          request: {
            contentType: "image/jpeg",
            uploadType: "postImage",
            size: blob.size,
            md5Sum: await md5(blob),
          },
        });
      } else if (item.kind === "video") {
        const contentType = item.file.type || "video/mp4";
        prepared.push({
          item,
          blob: item.file,
          contentType,
          request: {
            contentType,
            uploadType: "postVideo",
            size: item.file.size,
            previewImagePercent: item.posterPercent,
            md5Sum: await md5(item.file),
          },
        });
      } else {
        const contentType = attachmentType(item);
        const fileMd5 = await md5(item.file);
        // The app renders a thumbnail for every attachment; the browser can
        // only do that for images, so other files go without (it's optional).
        let thumb: Prepared["thumb"];
        if (contentType.startsWith("image/")) {
          const blob = await toJpeg(item.file, THUMB_MAX_EDGE).catch(
            () => null,
          );
          if (blob) {
            thumb = {
              blob,
              // The app sends the attachment's own MD5 for its thumbnail too.
              request: {
                contentType: "image/jpeg",
                uploadType: "postPreviewImage",
                size: blob.size,
                md5Sum: fileMd5,
              },
            };
          }
        }
        prepared.push({
          item,
          blob: item.file,
          contentType,
          request: {
            contentType,
            uploadType: "postFile",
            size: item.file.size,
            originalFilename: item.filename,
            md5Sum: fileMd5,
          },
          thumb,
        });
      }
    } else {
      prepared.push({ item });
    }
  }

  const requests = prepared.flatMap((p) => [
    ...(p.request ? [p.request] : []),
    ...(p.thumb ? [p.thumb.request] : []),
  ]);
  const slots = requests.length ? await getUploadSlots(requests) : [];
  // Slots pair with elements by type, first unused first, as in the app.
  const used = new Set<UploadSlot>();
  const take = (type: UploadType) => {
    const slot = slots.find((s) => s.uploadType === type && !used.has(s));
    if (!slot)
      throw new PortalApiError("The server didn't return an upload slot");
    used.add(slot);
    return slot;
  };

  const uploads: PendingUpload[] = [];
  const elements: MediaElementIn[] = [];
  let index = 0;
  for (const p of prepared) {
    const { item } = p;
    const el: MediaElementIn = {
      mediaElementId: item.id,
      indexInPost: item.kind === "text" && item.isTitle ? -1 : index++,
      mediaType: item.kind,
      mediaText: null,
    };
    switch (item.kind) {
      case "text":
        el.mediaText = item.text.trim();
        if (item.link) {
          el.attachmentTitle = item.link.title;
          el.attachmentImage = item.link.image;
          el.attachmentDescription = item.link.description;
          el.attachmentBaseUrl = item.link.baseUrl;
          el.attachmentDestinationUrl = item.link.destination ?? item.link.url;
        }
        break;
      case "poll":
        el.mediaText = item.prompt.trim();
        el.properties = JSON.stringify(
          item.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        );
        break;
      case "file":
        el.mediaText = item.caption.trim() || null;
        el.properties = JSON.stringify({
          originalFilename: item.filename,
          allowDownload: item.allowDownload ? "true" : "false",
        });
        break;
      default:
        el.mediaText = item.caption.trim() || null;
    }
    if (p.request && p.blob && p.contentType) {
      const slot = take(p.request.uploadType);
      el.fileKey = slot.fileKey;
      uploads.push({
        mediaElementId: item.id,
        fileKey: slot.fileKey,
        uploadFileUrl: slot.uploadFileUrl,
        blob: p.blob,
        contentType: p.contentType,
        filename:
          item.kind === "file"
            ? item.filename
            : `${item.id}.${p.contentType.split("/")[1] ?? "bin"}`,
      });
    }
    if (p.thumb) {
      const slot = take("postPreviewImage");
      el.previewImageFileKey = slot.fileKey;
      uploads.push({
        mediaElementId: item.id,
        fileKey: slot.fileKey,
        uploadFileUrl: slot.uploadFileUrl,
        blob: p.thumb.blob,
        contentType: "image/jpeg",
        filename: `${item.id}-preview.jpg`,
      });
    }
    elements.push(el);
  }

  onStage?.("Posting…");
  const { mode } = draft;
  const data = await portalQuery<CreatePostData>(CREATE_POST, {
    parentPostId: mode.type === "edit" ? mode.parentPostId : null,
    postGroupId: draft.postGroupId,
    categoryKey: draft.categoryKey,
    additionalCloneCategoryKeys: draft.additionalCategoryKeys,
    isEditingPost: mode.type === "edit" ? mode.postId : null,
    quotedPostId:
      mode.type === "quote"
        ? mode.quotedPostId
        : mode.type === "edit"
          ? mode.quotedPostId
          : null,
    clonedPostId: draft.clonedPostId,
    mediaElements: draft.clonedPostId ? [] : elements,
    anonymous: draft.anonymous,
    anonymousPostToken:
      mode.type === "edit" ? anonymousPostToken(mode.postId) : null,
    postAsUserId: draft.postAsUserId,
    sponsorshipBountyId: draft.sponsorshipBountyId,
  });
  const res = data.createPost;
  const postId = res.results?.postId;
  if (!res.success || !postId) {
    throw new PortalApiError(
      res.errorMsg ?? "Something went wrong.",
      res.errorCode,
    );
  }
  ingestStore(client, res.store);
  if (res.anonymousPostToken) {
    rememberAnonymousPostToken(postId, res.anonymousPostToken);
  }
  const post = res.store?.posts?.find((p) => p?.postId === postId) ?? null;
  return { postId, post, uploads };
}

/* ── Autocomplete and link previews ───────────────────────────────────── */

const SEARCH_USERNAMES = /* GraphQL */ `
  query searchForUsernamesThatMatch($searchText: String) {
    searchForUsernamesThatMatch(searchText: $searchText) {
      success
      errorMsg
      errorCode
      results {
        userIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

const SEARCH_HASHTAGS = /* GraphQL */ `
  query searchForHashtagsThatMatch($postGroupId: ID, $searchText: String) {
    searchForHashtagsThatMatch(
      postGroupId: $postGroupId
      searchText: $searchText
    ) {
      success
      errorMsg
      errorCode
      results {
        hashtagIds
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

type SearchData<K extends string, F extends string> = Record<
  K,
  MurmurResponse & {
    results: Record<F, (string | null)[]> | null;
    store: StoreData | null;
  }
>;

/** Users or hashtags matching an @ or # token being typed. */
export function useTokenSearch(
  token: { sigil: "@" | "#"; text: string } | null,
  postGroupId: string,
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ["tokenSearch", token?.sigil, token?.text, postGroupId],
    enabled: !!token,
    queryFn: async (): Promise<string[]> => {
      if (!token) return [];
      if (token.sigil === "@") {
        const data = await portalQuery<
          SearchData<"searchForUsernamesThatMatch", "userIds">
        >(SEARCH_USERNAMES, { searchText: token.text });
        const res = data.searchForUsernamesThatMatch;
        if (!res.success) return [];
        ingestStore(client, res.store);
        return (res.results?.userIds ?? []).filter((id): id is string => !!id);
      }
      const data = await portalQuery<
        SearchData<"searchForHashtagsThatMatch", "hashtagIds">
      >(SEARCH_HASHTAGS, { postGroupId, searchText: token.text });
      const res = data.searchForHashtagsThatMatch;
      if (!res.success) return [];
      ingestStore(client, res.store);
      return (res.results?.hashtagIds ?? []).filter((id): id is string => !!id);
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

const GET_OPEN_GRAPH = /* GraphQL */ `
  query getOpenGraphValues($urls: [String!]!) {
    getOpenGraphValues(urls: $urls) {
      success
      errorMsg
      errorCode
      results {
        image
        title
        description
        baseUrl
        destination
      }
    }
  }
`;

/**
 * The first complete link in some text: an http(s) URL with whitespace after
 * it, so a link still being typed isn't looked up letter by letter.
 */
export function firstCompleteUrl(text: string): string | null {
  return text.match(/https?:\/\/[^\s]+(?=\s)/i)?.[0] ?? null;
}

export function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ["openGraph", url],
    enabled: !!url,
    queryFn: async (): Promise<LinkPreview | null> => {
      if (!url) return null;
      const data = await portalQuery<{
        getOpenGraphValues: MurmurResponse & {
          results: Omit<LinkPreview, "url">[] | null;
        };
      }>(GET_OPEN_GRAPH, { urls: [url] });
      const row = data.getOpenGraphValues.results?.[0];
      if (!data.getOpenGraphValues.success || !row) return null;
      if (!row.title && !row.image && !row.description) return null;
      return { url, ...row };
    },
    staleTime: Infinity,
  });
}

/* ── Who may do what (PostDetailAuthorView, PostSettingsGroup, PostTextEntry) ── */

/** Anonymous posts are all credited to this user (Post2.ANONYMOUS_USERID). */
export const ANONYMOUS_USER_ID = "37a4cf81-47af-46f2-96f0-b6c719366573";

/** An anonymous post this browser made: it holds the post's token. */
export function anonymousIsMe(post: PortalPost) {
  return (
    post.creatorUserId === ANONYMOUS_USER_ID &&
    !!anonymousPostToken(post.postId)
  );
}

type Me = { userId: string; isAdmin: number } | null | undefined;

export function canEditPost(post: PortalPost, me: Me) {
  if (!me || post.clonedPostId) return false;
  return (
    me.isAdmin > 100 || post.creatorUserId === me.userId || anonymousIsMe(post)
  );
}

/** "Post Follow-up": a quote of your own post. */
export function canQuotePost(post: PortalPost, me: Me) {
  if (!me || post.clonedPostId || post.parentPostId) return false;
  return (
    me.isAdmin > 10000 ||
    post.creatorUserId === me.userId ||
    anonymousIsMe(post)
  );
}

/* ── Moderator status (getMyModeratorStatus) ──────────────────────────── */

export interface ModeratorRights {
  canChangeCategory: number;
  canPostClones: number;
}

const GET_MY_MODERATOR_STATUS = /* GraphQL */ `
  query getMyModeratorStatus {
    getMyModeratorStatus {
      success
      errorMsg
      errorCode
      results {
        myModerationStatuses {
          postGroupId
          moderators {
            userId
            canChangeCategory
            canPostClones
          }
        }
      }
    }
  }
`;

/**
 * The groups the signed-in physician moderates, with their rights. The app
 * only learns this when Group Info is opened, so its clone and category
 * tools rarely show; the web asks once up front.
 */
export function useMyModeration(userId: string | undefined) {
  return useQuery({
    queryKey: ["myModeration", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Record<string, ModeratorRights>> => {
      const data = await portalQuery<{
        getMyModeratorStatus: MurmurResponse & {
          results: {
            myModerationStatuses:
              | {
                  postGroupId: string;
                  moderators: ({ userId: string } & ModeratorRights)[] | null;
                }[]
              | null;
          } | null;
        };
      }>(GET_MY_MODERATOR_STATUS);
      const out: Record<string, ModeratorRights> = {};
      for (const row of data.getMyModeratorStatus.results
        ?.myModerationStatuses ?? []) {
        const mine = row.moderators?.find((m) => m.userId === userId);
        if (mine) out[row.postGroupId] = mine;
      }
      return out;
    },
    staleTime: 5 * 60_000,
  });
}

/* ── Bounties (content creators; getAppSponsorshipModStats) ──────────── */

export interface Bounty {
  sponsorshipBountyId: string;
  bountyTopicId: string | null;
  bountyTopic: string | null;
  /** JSON: { examples: string[] }. */
  bountyProperties: string | null;
  partnerName: string | null;
  groupName: string | null;
  postGroupId: string;
  bountyPostValue: number | null;
}

const GET_BOUNTIES = /* GraphQL */ `
  query getAppSponsorshipModStats($requestedUserId: ID) {
    getAppSponsorshipModStats(requestedUserId: $requestedUserId) {
      success
      results {
        bounties {
          sponsorshipBountyId
          bountyTopicId
          bountyTopic
          bountyProperties
          partnerName
          groupName
          postGroupId
          bountyPostValue
        }
      }
    }
  }
`;

export function useBounties(enabled: boolean) {
  return useQuery({
    queryKey: ["bounties"],
    enabled,
    queryFn: async (): Promise<Bounty[]> => {
      const data = await portalQuery<{
        getAppSponsorshipModStats: {
          success: boolean;
          results: { bounties: Bounty[] | null } | null;
        };
      }>(GET_BOUNTIES, { requestedUserId: null });
      return data.getAppSponsorshipModStats.results?.bounties ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function bountyExamples(b: Bounty): string[] {
  try {
    const parsed = JSON.parse(b.bountyProperties ?? "{}");
    return Array.isArray(parsed.examples) ? parsed.examples.map(String) : [];
  } catch {
    return [];
  }
}

/* ── Clone a post ─────────────────────────────────────────────────────── */

/**
 * The post id in a Murmur post link: <any host>/post/<uuid>, hyphens
 * optional (ClonePostPopupView.getPostIdFromUrl).
 */
export function postIdFromLink(text: string): string | null {
  const raw = text.match(/https?:\/\/[^\s]+\.[^\s]+/i)?.[0];
  if (!raw) return null;
  let path: string[];
  try {
    path = new URL(raw).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
  if (path[0] !== "post" || !path[1]) return null;
  const id = path[1].toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))
    return id;
  if (/^[0-9a-f]{32}$/.test(id)) {
    return [8, 4, 4, 4, 12]
      .reduce<{ parts: string[]; at: number }>(
        (acc, n) => ({
          parts: [...acc.parts, id.slice(acc.at, acc.at + n)],
          at: acc.at + n,
        }),
        { parts: [], at: 0 },
      )
      .parts.join("-");
  }
  return null;
}

/* ── Starting a quote or an edit ──────────────────────────────────────── */

export function quoteDraft(quoted: PortalPost): ComposeDraft {
  return {
    ...emptyDraft(
      { type: "quote", quotedPostId: quoted.postId },
      quoted.postGroupId,
    ),
    categoryKey: quoted.categoryKey,
    // A follow-up shares its original's anonymity.
    anonymous: quoted.creatorUserId === ANONYMOUS_USER_ID,
  };
}

/** A draft holding an existing post's elements, for editing. */
export function editDraft(
  post: PortalPost,
  elements: PortalMediaElement[],
): ComposeDraft {
  const items: ComposeItem[] = [];
  for (const el of [...elements].sort(
    (a, b) => (a.indexInPost ?? 0) - (b.indexInPost ?? 0),
  )) {
    const id = el.mediaElementId;
    const previewUrl = el.mediaPreviewImageUrl ?? el.mediaUrl;
    switch (el.mediaType) {
      case "text":
        items.push({
          kind: "text",
          id,
          text: el.mediaText ?? "",
          isTitle: el.indexInPost === -1,
          link:
            el.attachmentTitle || el.attachmentImage || el.attachmentDescription
              ? {
                  url: el.attachmentDestinationUrl ?? "",
                  title: el.attachmentTitle,
                  image: el.attachmentImage,
                  description: el.attachmentDescription,
                  baseUrl: el.attachmentBaseUrl ?? null,
                  destination: el.attachmentDestinationUrl,
                }
              : null,
        });
        break;
      case "image":
        items.push({
          kind: "image",
          id,
          caption: el.mediaText ?? "",
          file: null,
          uploaded: { previewUrl: el.mediaUrl ?? previewUrl },
        });
        break;
      case "video":
        items.push({
          kind: "video",
          id,
          caption: el.mediaText ?? "",
          file: null,
          posterPercent: 0,
          uploaded: { previewUrl },
        });
        break;
      case "file": {
        let props: { originalFilename?: string; allowDownload?: string } = {};
        try {
          props = JSON.parse(el.properties ?? "{}");
        } catch {
          /* keep defaults */
        }
        items.push({
          kind: "file",
          id,
          caption: el.mediaText ?? "",
          file: null,
          filename: props.originalFilename ?? "File",
          allowDownload: props.allowDownload !== "false",
          uploaded: { previewUrl: el.mediaPreviewImageUrl },
        });
        break;
      }
      case "poll": {
        let options: { id: string; text: string }[] = [];
        try {
          const parsed = JSON.parse(el.properties ?? "[]");
          if (Array.isArray(parsed)) {
            options = parsed
              .filter((o) => typeof o?.id === "string")
              .map((o) => ({ id: o.id, text: String(o.text ?? "") }));
          }
        } catch {
          /* empty poll */
        }
        // Polls aren't uploads; the app lets every part be edited.
        items.push({ kind: "poll", id, prompt: el.mediaText ?? "", options });
        break;
      }
    }
  }
  return {
    mode: {
      type: "edit",
      postId: post.postId,
      parentPostId: post.parentPostId,
      quotedPostId: post.quotedPostId,
      lockedToGroup: (post.numComments ?? 0) > 0,
    },
    postGroupId: post.postGroupId,
    categoryKey: post.categoryKey,
    additionalCategoryKeys: [],
    anonymous: post.creatorUserId === ANONYMOUS_USER_ID,
    postAsUserId: null,
    clonedPostId: null,
    sponsorshipBountyId: null,
    items: items.length ? items : [newItem("text")],
    updatedAt: Date.now(),
  };
}
