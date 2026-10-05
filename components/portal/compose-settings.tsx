"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Bounty,
  bountyExamples,
  type ComposeDraft,
  type ModeratorRights,
  postIdFromLink,
  useLinkPreview,
} from "@/lib/portal/compose";
import type { CurrentUser } from "@/lib/portal/current-user";
import { useGroups } from "@/lib/portal/groups";
import { useUserSearch } from "@/lib/portal/messages";
import { FEED_GROUP_ID } from "@/lib/portal/queries";
import { entityKey, usePostGroup, useUser } from "@/lib/portal/store";
import type { PortalPostGroup } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";
import { LinkPreviewCard } from "./compose-text";
import GroupIcon from "./group-icon";

type SetDraft = (fn: (d: ComposeDraft) => ComposeDraft) => void;

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-background border-border/60 fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-2xl border p-5 shadow-2xl"
        >
          <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-muted-foreground w-20 shrink-0 text-sm">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}

const linkBtn =
  "text-primary text-sm font-medium hover:underline disabled:opacity-50";

/* ── Group ────────────────────────────────────────────────────────────── */

function GroupOption({
  group,
  selected,
  onPick,
}: {
  group: PortalPostGroup;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="hover:bg-foreground/[0.04] flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left"
      >
        <GroupIcon iconUrl={group.iconUrl} className="size-9" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {group.groupName}
        </span>
        {selected && <Check className="text-primary size-4" />}
      </button>
    </li>
  );
}

/** The groups the app's picker offers: joined, postable, not a DM. */
function GroupPicker({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const groups = useGroups();
  const postable = (groups.data ?? [])
    .map((id) => client.getQueryData<PortalPostGroup>(entityKey.group(id)))
    .filter(
      (g): g is PortalPostGroup =>
        !!g &&
        !!g.subscribed &&
        (g.canPost ?? 0) > 0 &&
        g.groupType !== "direct_message",
    );
  return (
    <Sheet title="Post to" onClose={onClose}>
      <div className="-mx-2 overflow-y-auto">
        {groups.isPending ? (
          <p className="text-muted-foreground px-2 py-4 text-sm">Loading…</p>
        ) : postable.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-sm">
            Join a group to post to it.
          </p>
        ) : (
          <ul>
            {postable.map((g) => (
              <GroupOption
                key={g.postGroupId}
                group={g}
                selected={g.postGroupId === current}
                onPick={() => {
                  onPick(g.postGroupId);
                  onClose();
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/* ── Post as (admins) ─────────────────────────────────────────────────── */

function UserResult({ id, onPick }: { id: string; onPick: () => void }) {
  const user = useUser(id);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="hover:bg-foreground/[0.04] flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left"
      >
        <Avatar user={user} className="size-9" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">
            {user?.displayName || user?.username}
          </span>
          <span className="text-muted-foreground truncate text-sm">
            @{user?.username}
          </span>
        </span>
      </button>
    </li>
  );
}

function PostAsPicker({
  onPick,
  onClose,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const search = useUserSearch(text);
  return (
    <Sheet title="Select user to post as" onClose={onClose}>
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search by name or username"
        aria-label="Search users"
      />
      <div className="-mx-2 min-h-24 overflow-y-auto">
        {text.trim().length < 3 ? (
          <p className="text-muted-foreground px-2 py-2 text-sm">
            Type at least 3 characters.
          </p>
        ) : (
          <ul>
            {(search.data ?? []).map((id) => (
              <UserResult
                key={id}
                id={id}
                onPick={() => {
                  onPick(id);
                  onClose();
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/* ── Clone a post (moderators with canPostClones) ─────────────────────── */

function ClonePicker({
  current,
  onSave,
  onClose,
}: {
  current: string | null;
  onSave: (postId: string, label: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const postId = postIdFromLink(text);
  const url = postId ? (text.match(/https?:\/\/\S+/i)?.[0] ?? null) : null;
  const preview = useLinkPreview(url);
  // As in the app, a link counts only once its preview has loaded.
  const ready = !!postId && !!preview.data;
  return (
    <Sheet title="Clone a post" onClose={onClose}>
      <p className="text-muted-foreground text-sm">
        Paste a valid Murmur post link below.
      </p>
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://murmurmd.com/post/…"
        aria-label="Post link"
      />
      {postId && preview.isFetching && (
        <p className="text-muted-foreground text-sm">Looking up URL info…</p>
      )}
      {text && !postId && (
        <p className="text-muted-foreground text-sm">
          That isn&apos;t a Murmur post link.
        </p>
      )}
      {preview.data && <LinkPreviewCard preview={preview.data} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="glow"
          disabled={!ready || postId === current}
          onClick={() => {
            if (!postId) return;
            onSave(
              postId,
              preview.data?.title || preview.data?.baseUrl || postId,
            );
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}

/* ── Bounty (content creators) ────────────────────────────────────────── */

function bountyLabel(b: Bounty) {
  return b.bountyTopic ? `${b.groupName} - “${b.bountyTopic}”` : b.groupName;
}

function BountyPicker({
  bounties,
  onPick,
  onClose,
}: {
  bounties: Bounty[];
  onPick: (b: Bounty) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Choose a bounty" onClose={onClose}>
      <ul className="-mx-2 overflow-y-auto">
        {bounties.map((b) => (
          <li key={b.sponsorshipBountyId}>
            <button
              type="button"
              onClick={() => {
                onPick(b);
                onClose();
              }}
              className="hover:bg-foreground/[0.04] flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {bountyLabel(b)}
                </span>
                {b.partnerName && (
                  <span className="text-muted-foreground block truncate text-xs">
                    {b.partnerName}
                  </span>
                )}
              </span>
              {b.bountyPostValue != null && (
                <span className="text-primary font-semibold tabular-nums">
                  ${b.bountyPostValue}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function BountySection({
  draft,
  setDraft,
  bounties,
  disabled,
}: {
  draft: ComposeDraft;
  setDraft: SetDraft;
  bounties: Bounty[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = bounties.find(
    (b) => b.sponsorshipBountyId === draft.sponsorshipBountyId,
  );
  const examples = selected ? bountyExamples(selected) : [];
  return (
    <Row label="Bounty">
      {selected ? (
        <>
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
            {bountyLabel(selected)}
            {selected.bountyPostValue != null &&
              ` · $${selected.bountyPostValue}`}
          </span>
          <button
            type="button"
            className="text-destructive-foreground text-sm font-medium hover:underline"
            disabled={disabled}
            onClick={() =>
              setDraft((d) => ({ ...d, sponsorshipBountyId: null }))
            }
          >
            Cancel
          </button>
          {examples.length > 0 && (
            <span className="text-muted-foreground w-full text-xs">
              (e.g. {examples.join(", ")})
            </span>
          )}
        </>
      ) : (
        <button
          type="button"
          className={linkBtn}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          Select bounty…
        </button>
      )}
      {open && (
        <BountyPicker
          bounties={bounties}
          onClose={() => setOpen(false)}
          onPick={(b) =>
            setDraft((d) => ({
              ...d,
              sponsorshipBountyId: b.sponsorshipBountyId,
              // A bounty belongs to a group; picking one posts there.
              postGroupId: b.postGroupId,
              categoryKey:
                d.postGroupId === b.postGroupId ? d.categoryKey : null,
              anonymous: false,
              postAsUserId: null,
              clonedPostId: null,
            }))
          }
        />
      )}
    </Row>
  );
}

/* ── The card ─────────────────────────────────────────────────────────── */

/**
 * PostSettingsCell: where the post goes and as whom. Shown for new posts and
 * edits; a quote posts into its original's group, so it shows only the
 * bounty row (and the category picker below).
 */
export default function ComposeSettings({
  draft,
  setDraft,
  me,
  moderation,
  bounties,
  cloneLabel,
  setCloneLabel,
  disabled,
}: {
  draft: ComposeDraft;
  setDraft: SetDraft;
  me: CurrentUser;
  moderation: Record<string, ModeratorRights>;
  bounties: Bounty[];
  cloneLabel: string | null;
  setCloneLabel: (label: string | null) => void;
  disabled?: boolean;
}) {
  const [sheet, setSheet] = useState<"group" | "postAs" | "clone" | null>(null);
  const group = usePostGroup(
    draft.postGroupId === FEED_GROUP_ID ? null : draft.postGroupId,
  );
  const postAs = useUser(draft.postAsUserId);
  const { mode } = draft;
  const bounty = !!draft.sponsorshipBountyId;

  const groupLocked = mode.type === "edit" && mode.lockedToGroup;
  // Anonymity can't be changed on an edited comment: whether it may be
  // anonymous depends on its thread, which this page doesn't load.
  const showAnonymous = !bounty && !(mode.type === "edit" && mode.parentPostId);
  const showPostAs = me.isAdmin > 150 && !draft.anonymous && !bounty;
  const showClone =
    mode.type === "new" &&
    draft.postGroupId !== FEED_GROUP_ID &&
    moderation[draft.postGroupId]?.canPostClones === 1 &&
    !bounty;
  const showBounty = !!me.isContentCreator && mode.type === "new";

  const changeGroup = (postGroupId: string) =>
    setDraft((d) =>
      d.postGroupId === postGroupId
        ? d
        : {
            ...d,
            postGroupId,
            categoryKey: null,
            additionalCategoryKeys: [],
            sponsorshipBountyId: null,
            clonedPostId: null,
          },
    );

  return (
    <div className="bg-muted/40 border-border/60 flex flex-col gap-1 rounded-2xl border px-4 py-3">
      <Row label="Post to">
        {group ? (
          <span className="flex min-w-0 items-center gap-2">
            <GroupIcon iconUrl={group.iconUrl} className="size-6" />
            <span className="truncate font-medium">{group.groupName}</span>
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            {draft.postGroupId === FEED_GROUP_ID
              ? "No group chosen"
              : "Loading…"}
          </span>
        )}
        {!groupLocked && (
          <button
            type="button"
            className={linkBtn}
            disabled={disabled}
            onClick={() => setSheet("group")}
          >
            {group ? "Change…" : "Select…"}
          </button>
        )}
      </Row>
      {groupLocked && (
        <p className="text-muted-foreground pb-1 text-xs">
          Once someone replies to your post, you can no longer move it to
          another group.
        </p>
      )}

      {showBounty && (
        <BountySection
          draft={draft}
          setDraft={setDraft}
          bounties={bounties}
          disabled={disabled}
        />
      )}

      {showAnonymous && (
        <label className="flex min-h-9 items-center justify-between gap-3 text-sm">
          <span>Post anonymously</span>
          <input
            type="checkbox"
            role="switch"
            checked={draft.anonymous}
            disabled={disabled}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                anonymous: e.target.checked,
                postAsUserId: e.target.checked ? null : d.postAsUserId,
              }))
            }
            className="accent-primary size-4"
          />
        </label>
      )}

      {showPostAs && (
        <Row label="Post as">
          {postAs ? (
            <span className="font-medium">@{postAs.username}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Yourself</span>
          )}
          <button
            type="button"
            className={linkBtn}
            disabled={disabled}
            onClick={() => setSheet("postAs")}
          >
            Select…
          </button>
          {postAs && (
            <button
              type="button"
              className={linkBtn}
              disabled={disabled}
              onClick={() => setDraft((d) => ({ ...d, postAsUserId: null }))}
            >
              Clear
            </button>
          )}
        </Row>
      )}

      {showClone && (
        <Row label="Clone">
          {draft.clonedPostId ? (
            <span className="border-border max-w-full truncate rounded-md border px-2 py-0.5 text-sm">
              {cloneLabel ?? draft.clonedPostId}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Not a clone</span>
          )}
          <button
            type="button"
            className={linkBtn}
            disabled={disabled}
            onClick={() => setSheet("clone")}
          >
            Set target post…
          </button>
          {draft.clonedPostId && (
            <button
              type="button"
              className={linkBtn}
              disabled={disabled}
              onClick={() => {
                setDraft((d) => ({ ...d, clonedPostId: null }));
                setCloneLabel(null);
              }}
            >
              Clear
            </button>
          )}
        </Row>
      )}

      {sheet === "group" && (
        <GroupPicker
          current={draft.postGroupId}
          onPick={changeGroup}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "postAs" && (
        <PostAsPicker
          onPick={(id) => setDraft((d) => ({ ...d, postAsUserId: id }))}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "clone" && (
        <ClonePicker
          current={draft.clonedPostId}
          onSave={(postId, label) => {
            setDraft((d) => ({ ...d, clonedPostId: postId }));
            setCloneLabel(label);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/* ── Category (PostGroupCategoryItem) ─────────────────────────────────── */

/** Whether the author picks a category in this group. */
export function showCategoryPicker(
  group: PortalPostGroup | undefined,
  rights: ModeratorRights | undefined,
) {
  if (!group?.categories?.length) return false;
  return (
    (group.onlyModsCanSetCategory ?? 1) === 0 ||
    (rights?.canChangeCategory ?? 0) > 0
  );
}

/**
 * The key a draft should carry in a group: its own if the group still has
 * it, else "default" when there is such a category, else the first. (The
 * app sets "default" even when no category has that key; this sends a key
 * that exists, matching what the picker shows.)
 */
export function effectiveCategoryKey(
  group: PortalPostGroup,
  key: string | null,
): string | null {
  const cats = [...(group.categories ?? [])].sort((a, b) => a.order - b.order);
  if (!cats.length) return key;
  if (key && cats.some((c) => c.key === key)) return key;
  return cats.find((c) => c.key === "default")?.key ?? cats[0].key;
}

export function CategoryPicker({
  group,
  draft,
  setDraft,
  isModerator,
  disabled,
}: {
  group: PortalPostGroup;
  draft: ComposeDraft;
  setDraft: SetDraft;
  isModerator: boolean;
  disabled?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const cats = [...(group.categories ?? [])].sort((a, b) => a.order - b.order);
  const current = effectiveCategoryKey(group, draft.categoryKey);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Posts in this group must be assigned a category:
      </p>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c.categoryId}
            type="button"
            role="radio"
            aria-checked={c.key === current}
            disabled={disabled}
            onClick={() => setDraft((d) => ({ ...d, categoryKey: c.key }))}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              c.key === current
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-foreground/[0.04]",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      {isModerator && cats.length > 1 && (
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            Additional categories…
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                moreOpen && "rotate-180",
              )}
            />
          </button>
          {moreOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              <p className="text-muted-foreground text-xs">
                Additionally, you can clone the post into other categories as
                well:
              </p>
              {cats.map((c) => (
                <label
                  key={c.categoryId}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={draft.additionalCategoryKeys.includes(c.key)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        additionalCategoryKeys: e.target.checked
                          ? [...d.additionalCategoryKeys, c.key]
                          : d.additionalCategoryKeys.filter((k) => k !== c.key),
                      }))
                    }
                    className="accent-primary size-4"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
