import type { ComposeDraft, ComposeMode } from "./compose";

/**
 * The in-progress post, kept in this browser so leaving the page doesn't
 * lose it: the web counterpart of the app's abandoned-post recovery
 * (PostCreationModel.attemptLoadOfAbandonedPost). IndexedDB rather than
 * localStorage because drafts hold the picked photo, video and file blobs.
 *
 * One draft per kind of compose: a new post, a quote of a given post, an
 * edit of a given post. Every call tolerates IndexedDB being unavailable
 * (private windows, blocked storage) by doing nothing.
 */

const DB = "murmur-portal";
const STORE = "composeDrafts";

export function draftKey(mode: ComposeMode): string {
  switch (mode.type) {
    case "new":
      return "new";
    case "quote":
      return `quote-${mode.quotedPostId}`;
    case "edit":
      return `edit-${mode.postId}`;
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result as T);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    return null;
  }
}

export async function loadDraft(key: string): Promise<ComposeDraft | null> {
  return (await run<ComposeDraft>("readonly", (s) => s.get(key))) ?? null;
}

export async function saveDraft(key: string, draft: ComposeDraft) {
  await run("readwrite", (s) => s.put(draft, key));
}

export async function deleteDraft(key: string) {
  await run("readwrite", (s) => s.delete(key));
}
