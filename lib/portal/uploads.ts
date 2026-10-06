import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import * as tus from "tus-js-client";

import type { PendingUpload, SubmitResult } from "./compose";
import type { FeedPage } from "./feed";
import { postListKey } from "./feed";
import { accessToken, portalQuery } from "./graphql";
import { FEED_GROUP_ID, STORE_FRAGMENT } from "./queries";
import { entityKey, ingestStore } from "./store";
import type {
  MurmurResponse,
  PortalPost,
  PortalPostGroup,
  StoreData,
} from "./types";

/**
 * Posts whose media is still on its way, the app's UploadingPosts /
 * UploadingFilesView. createPost has already made the post, unpublished;
 * here its files go up by tus (one creation POST and one PATCH each, the
 * API token as a bare authorization header, the fileKey in the metadata so
 * the upload server can tie the bytes to the element), then
 * getPostUploadStatus is polled until the server says it is published, at
 * which point it joins the top of the feed and its group.
 *
 * State lives at module level so the uploads keep going while the author
 * moves around the portal; a full page load or closing the tab ends them
 * (a beforeunload prompt warns first). The post then stays unpublished on
 * the server, as it does when the app is killed mid-upload.
 */

export interface UploadingPost {
  postId: string;
  postGroupId: string;
  /** A line of the post's text, for the card. */
  label: string;
  /** Object URL of the first photo or video, for the card. */
  thumbUrl: string | null;
  thumbIsVideo: boolean;
  /** False for a direct message, which shows its progress in the conversation. */
  inFeed: boolean;
  bytesSent: number;
  bytesTotal: number;
  status: "uploading" | "processing" | "failed" | "slow";
  error: string | null;
}

interface Entry extends UploadingPost {
  uploads: (PendingUpload & { sent: number; done: boolean })[];
  onPublished?: () => void;
}

const entries = new Map<string, Entry>();
let snapshot: UploadingPost[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...entries.values()].map(
    ({ uploads: _uploads, onPublished: _onPublished, ...rest }) => rest,
  );
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: UploadingPost[] = [];

function useAllUploading() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/**
 * Posts still uploading or processing, oldest first: a group's own, or for
 * the feed every one meant for it (direct messages show in their thread).
 */
export function useUploadingPosts(postGroupId?: string): UploadingPost[] {
  const all = useAllUploading();
  return postGroupId && postGroupId !== FEED_GROUP_ID
    ? all.filter((p) => p.postGroupId === postGroupId)
    : all.filter((p) => p.inFeed);
}

/** One post's upload, while it lasts. */
export function useUploadingPost(postId: string): UploadingPost | undefined {
  return useAllUploading().find((p) => p.postId === postId);
}

function update(postId: string, patch: Partial<Entry>) {
  const e = entries.get(postId);
  if (!e) return;
  Object.assign(e, patch);
  emit();
}

let unloadGuard = false;
function guardUnload() {
  if (unloadGuard || typeof window === "undefined") return;
  unloadGuard = true;
  window.addEventListener("beforeunload", (event) => {
    if ([...entries.values()].some((e) => e.status === "uploading")) {
      event.preventDefault();
    }
  });
}

/* ── Feed placement ───────────────────────────────────────────────────── */

function prepend(client: QueryClient, key: readonly unknown[], postId: string) {
  client.setQueryData<InfiniteData<FeedPage>>(key, (data) => {
    if (!data?.pages.length) return data;
    if (data.pages.some((p) => p.postIds.includes(postId))) return data;
    const [first, ...rest] = data.pages;
    return {
      ...data,
      pages: [{ ...first, postIds: [postId, ...first.postIds] }, ...rest],
    };
  });
}

/**
 * Puts a newly published top-level post at the top of its group and, when
 * the author follows that group, the feed (MurmurAPI.createPost's optimistic
 * insert). Category tabs are refetched rather than guessed at.
 */
export function placePublishedPost(client: QueryClient, post: PortalPost) {
  if (post.parentPostId) return;
  prepend(client, postListKey(post.postGroupId), post.postId);
  const group = client.getQueryData<PortalPostGroup>(
    entityKey.group(post.postGroupId),
  );
  if (group?.subscribed)
    prepend(client, postListKey(FEED_GROUP_ID), post.postId);
  void client.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === "posts" &&
      q.queryKey[1] === post.postGroupId &&
      Array.isArray(q.queryKey[2]) &&
      q.queryKey[2].length > 0,
  });
}

/* ── Status polling ───────────────────────────────────────────────────── */

const GET_POST_UPLOAD_STATUS = /* GraphQL */ `
  query getPostUploadStatus($postIds: [ID!]!) {
    getPostUploadStatus(postIds: $postIds) {
      success
      errorMsg
      errorCode
      results {
        postId
        publishedDate
        isPublished
        isDeleted
      }
      store {
        ...portalStore
      }
    }
  }
  ${STORE_FRAGMENT}
`;

interface UploadStatusData {
  getPostUploadStatus: MurmurResponse & {
    results:
      | {
          postId: string;
          isPublished: boolean | number | null;
          isDeleted: boolean | number | null;
        }[]
      | null;
    store: StoreData | null;
  };
}

/** The app checks every 5 s. */
const POLL_MS = 5000;
/** After this long processing, stop watching and say it'll turn up. */
const SLOW_AFTER_MS = 10 * 60_000;

async function watchUntilPublished(client: QueryClient, postId: string) {
  const started = Date.now();
  while (entries.has(postId)) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!entries.has(postId)) return;
    try {
      const data = await portalQuery<UploadStatusData>(GET_POST_UPLOAD_STATUS, {
        postIds: [postId],
      });
      const res = data.getPostUploadStatus;
      ingestStore(client, res.store);
      const row = res.results?.find((r) => r.postId === postId);
      if (row?.isDeleted) {
        update(postId, {
          status: "failed",
          error: "The server discarded this post.",
        });
        return;
      }
      if (row?.isPublished) {
        const post = client.getQueryData<PortalPost>(entityKey.post(postId));
        if (post) placePublishedPost(client, post);
        void client.invalidateQueries({ queryKey: ["postFull", postId] });
        entries.get(postId)?.onPublished?.();
        finish(postId);
        return;
      }
    } catch {
      /* transient; try again next tick */
    }
    if (Date.now() - started > SLOW_AFTER_MS) {
      update(postId, { status: "slow" });
      return;
    }
  }
}

function finish(postId: string) {
  const e = entries.get(postId);
  if (e?.thumbUrl) URL.revokeObjectURL(e.thumbUrl);
  entries.delete(postId);
  emit();
}

/* ── tus ──────────────────────────────────────────────────────────────── */

function runUpload(
  postId: string,
  upload: Entry["uploads"][number],
  token: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const job = new tus.Upload(upload.blob, {
      endpoint: upload.uploadFileUrl,
      // The app sends the bare token, no "Bearer".
      headers: { authorization: token },
      metadata: {
        filename: upload.filename,
        filetype: upload.contentType,
        postId,
        fileKey: upload.fileKey,
        mediaElementId: upload.mediaElementId,
      },
      retryDelays: [0, 1000, 3000, 10000],
      onProgress: (sent) => {
        upload.sent = sent;
        const e = entries.get(postId);
        if (e) {
          e.bytesSent = e.uploads.reduce((n, u) => n + u.sent, 0);
          emit();
        }
      },
      onError: (error) => reject(new Error(`Upload failed: ${error.message}`)),
      onSuccess: () => {
        upload.done = true;
        upload.sent = upload.blob.size;
        resolve();
      },
    });
    // Resume an interrupted upload of the same file rather than restart it.
    job
      .findPreviousUploads()
      .then((previous) => {
        if (previous[0]) job.resumeFromPreviousUpload(previous[0]);
        job.start();
      })
      .catch(() => job.start());
  });
}

async function runAll(client: QueryClient, postId: string) {
  const e = entries.get(postId);
  if (!e) return;
  update(postId, { status: "uploading", error: null });
  try {
    const token = await accessToken();
    // One at a time: the server publishes only when all have landed anyway,
    // and a single stream keeps progress honest on a slow connection.
    for (const u of e.uploads) {
      if (!u.done) await runUpload(postId, u, token);
    }
  } catch (error) {
    update(postId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Upload failed",
    });
    return;
  }
  update(postId, { status: "processing", bytesSent: e.bytesTotal });
  await watchUntilPublished(client, postId);
}

/**
 * Takes over after createPost. A post with nothing to upload that came back
 * published goes straight into the lists; anything else gets a card.
 */
export function startUploads(
  client: QueryClient,
  result: SubmitResult,
  card: {
    label: string;
    thumb: Blob | null;
    thumbIsVideo: boolean;
    /** Default true; a direct message passes false. */
    inFeed?: boolean;
    /** Runs once the server has published the post. */
    onPublished?: () => void;
  },
) {
  const { postId, post, uploads } = result;
  if (!uploads.length && post?.isPublished) {
    placePublishedPost(client, post);
    card.onPublished?.();
    return;
  }
  guardUnload();
  entries.set(postId, {
    postId,
    postGroupId: post?.postGroupId ?? FEED_GROUP_ID,
    label: card.label,
    thumbUrl: card.thumb ? URL.createObjectURL(card.thumb) : null,
    thumbIsVideo: card.thumbIsVideo,
    inFeed: card.inFeed ?? true,
    onPublished: card.onPublished,
    bytesSent: 0,
    bytesTotal: uploads.reduce((n, u) => n + u.blob.size, 0),
    status: uploads.length ? "uploading" : "processing",
    error: null,
    uploads: uploads.map((u) => ({ ...u, sent: 0, done: false })),
  });
  emit();
  void (uploads.length
    ? runAll(client, postId)
    : watchUntilPublished(client, postId));
}

export function retryUploads(client: QueryClient, postId: string) {
  const e = entries.get(postId);
  if (!e) return;
  if (e.uploads.every((u) => u.done)) {
    update(postId, { status: "processing", error: null });
    void watchUntilPublished(client, postId);
  } else {
    void runAll(client, postId);
  }
}

/** Stops tracking a post. Its server copy stays unpublished. */
export function dismissUpload(postId: string) {
  finish(postId);
}
