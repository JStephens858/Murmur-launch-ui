"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_ACCEPT,
  type Bounty,
  cleanUp,
  type ComposeDraft,
  type ComposeItem,
  type ComposeMode,
  editDraft,
  emptyDraft,
  itemForFile,
  newItem,
  postProblem,
  quoteDraft,
  submitDraft,
  useBounties,
  useMyModeration,
} from "@/lib/portal/compose";
import {
  deleteDraft,
  draftKey,
  loadDraft,
  saveDraft,
} from "@/lib/portal/compose-draft";
import { type CurrentUser, useCurrentUser } from "@/lib/portal/current-user";
import { fullPostOptions } from "@/lib/portal/feed";
import { useGroups } from "@/lib/portal/groups";
import { FEED_GROUP_ID } from "@/lib/portal/queries";
import { useMediaElements, usePost, usePostGroup } from "@/lib/portal/store";
import type { PortalMediaElement, PortalPost } from "@/lib/portal/types";
import { startUploads } from "@/lib/portal/uploads";
import { cn } from "@/lib/utils";

import BackButton, { useGoBack } from "./back-button";
import {
  FileEditor,
  ImageEditor,
  ItemFrame,
  PollEditor,
  VideoEditor,
} from "./compose-items";
import ComposeSettings, {
  BountySection,
  CategoryPicker,
  effectiveCategoryKey,
  showCategoryPicker,
} from "./compose-settings";
import ComposeText from "./compose-text";
import { PortalError } from "./feed";
import {
  CameraIcon,
  DocTextBelowEcgIcon,
  PhotoOnRectangleAngledIcon,
  TextBadgeCheckmarkIcon,
  TextQuoteIcon,
} from "./icons";
import PortalPageHeader from "./page-header";
import PostCard from "./post-card";

const TITLES: Record<ComposeMode["type"], string> = {
  new: "New post",
  quote: "Follow-up",
  edit: "Edit post",
};

const ITEM_LABELS: Record<ComposeItem["kind"], string> = {
  text: "Text",
  image: "Photo",
  video: "Video",
  file: "File",
  poll: "Poll",
};

/** True when there is nothing worth keeping, so no draft is saved. */
function isPristine(d: ComposeDraft) {
  return (
    d.mode.type === "new" &&
    !d.clonedPostId &&
    !d.sponsorshipBountyId &&
    d.items.every((i) => i.kind === "text" && i.text.trim() === "")
  );
}

/**
 * The post composer (PostCreationView): `/compose/post` for a new post,
 * `?group=<id>` to start in a group, `?quote=<postId>` for a follow-up,
 * `?edit=<postId>` to edit. Works out the mode, waits for what it needs
 * (the signed-in user; the post for a quote or an edit), then hands a
 * starting draft to the form. A draft saved in this browser for the same
 * mode wins over a fresh one.
 */
export default function Compose() {
  const params = useSearchParams();
  const quoteId = params.get("quote");
  const editId = params.get("edit");
  const groupParam = params.get("group");
  const sourceId = editId ?? quoteId;

  const client = useQueryClient();
  const me = useCurrentUser();
  const source = useQuery({
    ...fullPostOptions(client, sourceId ?? ""),
    enabled: !!sourceId,
  });
  const sourcePost = usePost(sourceId);
  const sourceElements = useMediaElements(sourcePost?.mediaElementIds ?? []);

  const header = (
    <PortalPageHeader
      title={TITLES[editId ? "edit" : quoteId ? "quote" : "new"]}
      leading={<BackButton />}
    />
  );
  const error = me.error ?? (sourceId ? source.error : null);
  if (error) {
    return (
      <>
        {header}
        <PortalError error={error} retry={() => location.reload()} />
      </>
    );
  }
  const elementsReady = sourceElements.every(Boolean);
  if (
    !me.data ||
    (sourceId && (!sourcePost || !source.data || !elementsReady))
  ) {
    return (
      <>
        {header}
        <p className="text-muted-foreground px-4 py-8">Loading…</p>
      </>
    );
  }
  return (
    <DraftLoader
      key={sourceId ?? "new"}
      me={me.data}
      editPost={editId ? sourcePost! : null}
      editElements={sourceElements as PortalMediaElement[]}
      quotePost={quoteId && !editId ? sourcePost! : null}
      groupId={groupParam}
    />
  );
}

function DraftLoader({
  me,
  editPost,
  editElements,
  quotePost,
  groupId,
}: {
  me: CurrentUser;
  editPost: PortalPost | null;
  editElements: PortalMediaElement[];
  quotePost: PortalPost | null;
  groupId: string | null;
}) {
  const fresh = useMemo<ComposeDraft>(() => {
    if (editPost) return editDraft(editPost, editElements);
    if (quotePost) return quoteDraft(quotePost);
    return emptyDraft({ type: "new" }, groupId ?? FEED_GROUP_ID);
    // Built once; later store updates must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const key = draftKey(fresh.mode);
  const [initial, setInitial] = useState<{
    draft: ComposeDraft;
    restored: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;
    void loadDraft(key).then((saved) => {
      if (!live) return;
      if (saved) {
        // Coming from a group page into an ungrouped saved draft: use the group.
        const draft =
          groupId && saved.postGroupId === FEED_GROUP_ID
            ? { ...saved, postGroupId: groupId }
            : saved;
        setInitial({ draft, restored: true });
      } else {
        setInitial({ draft: fresh, restored: false });
      }
    });
    return () => {
      live = false;
    };
  }, [key, fresh, groupId]);

  if (!initial) return null;
  return (
    <ComposeForm
      me={me}
      draftStorageKey={key}
      initial={initial.draft}
      restored={initial.restored}
      fresh={fresh}
      quotePost={quotePost}
    />
  );
}

/** Whether this device has a camera input worth offering (phones, tablets). */
export function useCoarsePointer() {
  return useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

const toolClass = cn(
  "text-muted-foreground hover:text-primary flex min-w-14 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors",
  "has-[:disabled]:text-muted-foreground disabled:hover:text-muted-foreground has-[:disabled]:cursor-default has-[:disabled]:opacity-40 disabled:opacity-40",
);

/**
 * One toolbar entry. File-picking entries are labels around a hidden file
 * input, so the click reaches the picker without any ref plumbing.
 */
function ToolButton({
  label,
  icon: Icon,
  disabled,
  onClick,
  file,
  onFiles,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  onClick?: () => void;
  file?: { accept: string; multiple?: boolean; capture?: "environment" };
  onFiles?: (files: FileList | null) => void;
}) {
  const body = (
    <>
      <Icon className="size-6" />
      {label}
    </>
  );
  if (!file) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={toolClass}
      >
        {body}
      </button>
    );
  }
  return (
    <label className={toolClass}>
      {body}
      <input
        type="file"
        accept={file.accept}
        multiple={file.multiple}
        capture={file.capture}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles?.(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ComposeForm({
  me,
  draftStorageKey,
  initial,
  restored,
  fresh,
  quotePost,
}: {
  me: CurrentUser;
  draftStorageKey: string;
  initial: ComposeDraft;
  restored: boolean;
  fresh: ComposeDraft;
  quotePost: PortalPost | null;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const goBack = useGoBack();
  const [draft, setDraftState] = useState(initial);
  const [showRestored, setShowRestored] = useState(restored);
  const [problem, setProblem] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [cloneLabel, setCloneLabel] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const coarse = useCoarsePointer();
  const sending = stage !== null;

  // The group records (categories, moderators, canPost) come from the group
  // list; a restored draft or a ?group link may name one not yet loaded.
  useGroups();
  const moderation = useMyModeration(me.userId).data ?? {};
  const bountyQuery = useBounties(!!me.isContentCreator);
  const group = usePostGroup(
    draft.postGroupId === FEED_GROUP_ID ? null : draft.postGroupId,
  );
  const rights = moderation[draft.postGroupId];
  const { mode } = draft;

  const setDraft = (fn: (d: ComposeDraft) => ComposeDraft) => {
    setProblem(null);
    setDraftState((d) => ({ ...fn(d), updatedAt: Date.now() }));
  };

  // Autosave, lightly debounced. Nothing worth keeping clears the slot.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (sending) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (isPristine(draft)) void deleteDraft(draftStorageKey);
      else void saveDraft(draftStorageKey, draft);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, draftStorageKey, sending]);

  const updateItem = (next: ComposeItem) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === next.id ? next : i)),
    }));
  const removeItem = (id: string) =>
    setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  const moveItem = (id: string, by: -1 | 1) =>
    setDraft((d) => {
      const items = [...d.items];
      const at = items.findIndex((i) => i.id === id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= items.length) return d;
      [items[at], items[to]] = [items[to], items[at]];
      return { ...d, items };
    });
  const addItems = (items: ComposeItem[]) => {
    if (!items.length) return;
    setDraft((d) => ({
      ...d,
      // A lone empty text item is a placeholder; media replaces it.
      items:
        d.items.length === 1 &&
        d.items[0].kind === "text" &&
        !d.items[0].text.trim() &&
        items[0].kind !== "text"
          ? items
          : [...d.items, ...items],
    }));
    setFocusId(items[0].id);
  };
  const addFiles = (files: FileList | null, asAttachment = false) => {
    addItems([...(files ?? [])].map((f) => itemForFile(f, asAttachment)));
  };

  const bounties: Bounty[] = useMemo(() => {
    const all = bountyQuery.data ?? [];
    return mode.type === "quote"
      ? all.filter((b) => b.postGroupId === draft.postGroupId)
      : all;
  }, [bountyQuery.data, mode.type, draft.postGroupId]);

  const categoryShown = showCategoryPicker(group, rights);
  const canTitle =
    me.isAdmin > 10 || !!group?.moderatorUserIds?.includes(me.userId);
  const titleId = draft.items.find((i) => i.kind === "text" && i.isTitle)?.id;
  const isClone = !!draft.clonedPostId;

  const discard = async () => {
    await deleteDraft(draftStorageKey);
    setDraftState({ ...fresh, updatedAt: Date.now() });
    setCloneLabel(null);
    setShowRestored(false);
    setProblem(null);
  };

  const post = async () => {
    if (sending) return;
    let ready = cleanUp(draft);
    if (isClone) ready = { ...ready, items: [] };
    if (group && categoryShown) {
      ready = {
        ...ready,
        categoryKey: effectiveCategoryKey(group, ready.categoryKey),
      };
    }
    const issue = postProblem(ready);
    if (issue) {
      setProblem(issue);
      return;
    }
    setProblem(null);
    setStage("Checking…");
    try {
      if (ready.clonedPostId) {
        await client.fetchQuery(fullPostOptions(client, ready.clonedPostId));
        const target = client.getQueryData<PortalPost>([
          "post",
          ready.clonedPostId,
        ]);
        if (target?.rootPostId) {
          throw new Error(
            "You can't clone that post. You can only clone original top level posts.",
          );
        }
      }
      const result = await submitDraft(client, ready, setStage);
      const firstText = ready.items.find((i) => i.kind === "text");
      const firstMedia = ready.items.find(
        (i) => (i.kind === "image" || i.kind === "video") && i.file,
      );
      startUploads(client, result, {
        label:
          firstText?.kind === "text"
            ? firstText.text.split("\n")[0]
            : (cloneLabel ?? ""),
        thumb:
          firstMedia &&
          (firstMedia.kind === "image" || firstMedia.kind === "video")
            ? firstMedia.file
            : null,
        thumbIsVideo: firstMedia?.kind === "video",
      });
      await deleteDraft(draftStorageKey);
      if (mode.type === "edit") {
        void client.invalidateQueries({ queryKey: ["postFull", mode.postId] });
        router.replace(`/postDetail/${mode.postId}`);
      } else {
        goBack();
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Something went wrong.");
      setStage(null);
    }
  };

  return (
    <form
      className="flex min-h-dvh flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void post();
      }}
    >
      <PortalPageHeader
        title={TITLES[mode.type]}
        leading={<BackButton />}
        trailing={
          <Button
            type="submit"
            variant="glow"
            size="sm"
            className="rounded-full px-5"
            disabled={sending}
          >
            {sending
              ? (stage ?? "Posting…")
              : mode.type === "edit"
                ? "Save"
                : "Post"}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {showRestored && (
          <div className="bg-primary/10 flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
            <span className="flex-1">Restored your unsent draft.</span>
            <button
              type="button"
              onClick={() => void discard()}
              className="text-primary font-medium hover:underline"
            >
              Discard draft
            </button>
          </div>
        )}

        {mode.type === "quote" && quotePost ? (
          <div className="flex flex-col gap-2">
            {me.isContentCreator && bounties.length > 0 && (
              <div className="bg-muted/40 border-border/60 rounded-2xl border px-4 py-3">
                <BountySection
                  draft={draft}
                  setDraft={setDraft}
                  bounties={bounties}
                  disabled={sending}
                />
              </div>
            )}
            <p className="text-muted-foreground text-sm font-medium">
              Follow-up to:
            </p>
            {/* The original, for reference; not clickable from here. */}
            <div className="border-border/60 pointer-events-none overflow-hidden rounded-2xl border [&_article]:border-b-0">
              <PostCard postId={quotePost.postId} />
            </div>
          </div>
        ) : (
          <ComposeSettings
            draft={draft}
            setDraft={setDraft}
            me={me}
            moderation={moderation}
            bounties={bounties}
            cloneLabel={cloneLabel}
            setCloneLabel={setCloneLabel}
            disabled={sending}
          />
        )}

        {mode.type === "edit" && mode.quotedPostId && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm font-medium">
              Follow-up to:
            </p>
            <div className="border-border/60 pointer-events-none overflow-hidden rounded-2xl border [&_article]:border-b-0">
              <PostCard postId={mode.quotedPostId} />
            </div>
          </div>
        )}

        {group &&
          categoryShown &&
          !(mode.type === "edit" && mode.parentPostId) && (
            <CategoryPicker
              group={group}
              draft={draft}
              setDraft={setDraft}
              isModerator={!!rights}
              disabled={sending}
            />
          )}

        {isClone ? (
          <p className="text-muted-foreground border-border/60 rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
            You can&apos;t add other items to a clone.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {draft.items.map((item, i) => {
              const frame = {
                label:
                  item.kind === "text" && item.isTitle
                    ? "Title"
                    : ITEM_LABELS[item.kind],
                onRemove: () => removeItem(item.id),
                onMoveUp: i > 0 ? () => moveItem(item.id, -1) : undefined,
                onMoveDown:
                  i < draft.items.length - 1
                    ? () => moveItem(item.id, 1)
                    : undefined,
                disabled: sending,
              };
              return (
                <ItemFrame key={item.id} {...frame}>
                  {item.kind === "text" && (
                    <>
                      <ComposeText
                        item={item}
                        postGroupId={draft.postGroupId}
                        onChange={updateItem}
                        autoFocus={
                          focusId === item.id || (i === 0 && !restored)
                        }
                        disabled={sending}
                      />
                      {canTitle && (!titleId || titleId === item.id) && (
                        <label className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={!!item.isTitle}
                            disabled={sending}
                            onChange={(e) =>
                              updateItem({ ...item, isTitle: e.target.checked })
                            }
                            className="accent-primary size-3.5"
                          />
                          Use as title for post
                        </label>
                      )}
                    </>
                  )}
                  {item.kind === "image" && (
                    <ImageEditor
                      item={item}
                      onChange={updateItem}
                      disabled={sending}
                    />
                  )}
                  {item.kind === "video" && (
                    <VideoEditor
                      item={item}
                      onChange={updateItem}
                      canPickPoster={me.isAdmin > 10}
                      disabled={sending}
                    />
                  )}
                  {item.kind === "file" && (
                    <FileEditor
                      item={item}
                      onChange={updateItem}
                      disabled={sending}
                    />
                  )}
                  {item.kind === "poll" && (
                    <PollEditor
                      item={item}
                      onChange={updateItem}
                      disabled={sending}
                    />
                  )}
                </ItemFrame>
              );
            })}
          </div>
        )}

        {problem && (
          <p role="alert" className="text-destructive-foreground text-sm">
            {problem}
          </p>
        )}
      </div>

      {/* PostItemSelectionView: what can be added, pinned to the bottom. */}
      <div className="bg-background/90 border-border/40 sticky bottom-0 z-20 mt-auto flex items-center justify-around border-t px-2 py-2 backdrop-blur-md">
        <ToolButton
          label="Text"
          icon={TextQuoteIcon}
          disabled={sending || isClone}
          onClick={() => addItems([newItem("text")])}
        />
        <ToolButton
          label="Library"
          icon={PhotoOnRectangleAngledIcon}
          disabled={sending || isClone}
          file={{ accept: "image/*,video/*", multiple: true }}
          onFiles={(files) => addFiles(files)}
        />
        {coarse && (
          <ToolButton
            label="Camera"
            icon={CameraIcon}
            disabled={sending || isClone}
            file={{ accept: "image/*,video/*", capture: "environment" }}
            onFiles={(files) => addFiles(files)}
          />
        )}
        <ToolButton
          label="File"
          icon={DocTextBelowEcgIcon}
          disabled={sending || isClone}
          file={{ accept: ATTACHMENT_ACCEPT, multiple: true }}
          onFiles={(files) => addFiles(files, true)}
        />
        <ToolButton
          label="Poll"
          icon={TextBadgeCheckmarkIcon}
          disabled={sending || isClone}
          onClick={() => addItems([newItem("poll")])}
        />
      </div>
    </form>
  );
}
