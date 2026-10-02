"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CVDraft,
  type CVItemType,
  draftFrom,
  emptyDraft,
  type ExperienceGroup,
  fieldSpec,
  friendlyName,
  groupItems,
  listWithChange,
  TAG_ADD_TYPE_ID,
  type TypeOption,
  typeOptionsFor,
  useCVItemTypes,
  useSetCVItems,
  yearRange,
} from "@/lib/portal/experience";
import { type CVItem, useCVItems } from "@/lib/portal/profile";
import { cn } from "@/lib/utils";

import { PortalError } from "./feed";

/**
 * The Experience tab of a profile: the app's ProfileExperienceView2. Items
 * are grouped into sections; areas of focus render as chips, everything else
 * as cards with the type as a kicker, the title, the description and a year
 * range. Your own profile gets an Edit button to the editor page.
 */
export default function Experience({
  userId,
  isOwn,
}: {
  userId: string;
  isOwn: boolean;
}) {
  const cv = useCVItems(userId);
  const types = useCVItemTypes();
  if (cv.status === "pending")
    return <p className="text-muted-foreground px-4 py-8">Loading...</p>;
  if (cv.isError)
    return <PortalError error={cv.error} retry={() => cv.refetch()} />;
  const groups = groupItems(cv.data ?? [], types.data ?? [], false);

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium tracking-wide uppercase">
          Experience
        </h2>
        {isOwn && groups.length > 0 && (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/profile/experience">
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Link>
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="border-border flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-dashed p-4">
          <p className="text-muted-foreground text-sm">
            {isOwn
              ? "Add your training, practice, and credentials so colleagues can find common ground."
              : "No experience added yet."}
          </p>
          {isOwn && (
            <Button asChild variant="glow" size="sm" className="rounded-full">
              <Link href="/profile/experience">
                <Plus className="size-3.5" aria-hidden />
                Add your experience
              </Link>
            </Button>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <Section key={group.id} group={group} types={types.data ?? []} />
        ))
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-accent-alt text-xs font-bold tracking-[0.05em] uppercase">
      {children}
    </h3>
  );
}

function Section({
  group,
  types,
}: {
  group: ExperienceGroup;
  types: CVItemType[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{group.label}</SectionLabel>
      {group.isTagLike ? (
        <TagSection group={group} types={types} />
      ) : (
        group.items.map((item) => (
          <ExperienceCard key={item.itemId} item={item} types={types} />
        ))
      )}
    </section>
  );
}

/** Title or type name, then description, then the year range. Legacy rows carry company and location instead of a description. */
export function ExperienceCard({
  item,
  types,
  onEdit,
}: {
  item: CVItem;
  types: CVItemType[];
  onEdit?: () => void;
}) {
  const kicker = friendlyName(item.itemType, types);
  const primary = item.title || kicker;
  const legacy = [item.companyName, item.location].filter(Boolean).join(" · ");
  const secondary =
    item.description && item.description !== primary
      ? item.description
      : legacy || null;
  const years = fieldSpec(item.itemType).isTagLike ? null : yearRange(item);
  return (
    <div className="border-border/60 bg-card/50 flex items-start gap-3 rounded-2xl border p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-accent-alt text-[11px] font-bold tracking-wide uppercase">
          {kicker}
        </p>
        <p className="font-semibold">{primary}</p>
        {secondary && <p className="text-sm">{secondary}</p>}
        {years && <p className="text-muted-foreground text-sm">{years}</p>}
      </div>
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Edit ${primary}`}
          onClick={onEdit}
          className="-mt-1 -mr-1 shrink-0 rounded-full"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

function TagSection({
  group,
  types,
  onAdd,
  onDelete,
}: {
  group: ExperienceGroup;
  types: CVItemType[];
  onAdd?: () => void;
  onDelete?: (item: CVItem) => void;
}) {
  return (
    <div className="border-border bg-card/50 flex flex-wrap gap-2 rounded-2xl border p-3">
      {group.items.map((item) => {
        const name = item.title || friendlyName(item.itemType, types);
        return (
          <span
            key={item.itemId}
            className={cn(
              "border-border inline-flex items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pl-3 text-sm font-medium",
              onDelete ? "pr-1.5" : "pr-3",
            )}
          >
            {name}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                aria-label={`Remove ${name}`}
                className="bg-accent-alt/15 text-accent-alt hover:bg-accent-alt/30 flex size-5 items-center justify-center rounded-full"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </span>
        );
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="border-border text-accent-alt hover:bg-muted inline-flex items-center gap-1 rounded-full border-[1.5px] border-dashed px-3 py-1.5 text-sm font-medium"
        >
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

interface SheetState {
  draft: CVDraft;
  options: TypeOption[];
  isAdd: boolean;
}

/**
 * The editor page: the app's EditExperienceListView. Every section is shown
 * so there is always somewhere to add; cards edit in a sheet, chips delete in
 * place. Each change saves the whole list, as the app does.
 */
export function EditExperienceList({ userId }: { userId: string }) {
  const cv = useCVItems(userId);
  const types = useCVItemTypes();
  const save = useSetCVItems(userId);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  if (cv.status === "pending")
    return <p className="text-muted-foreground px-4 py-8">Loading...</p>;
  if (cv.isError)
    return <PortalError error={cv.error} retry={() => cv.refetch()} />;
  const items = cv.data ?? [];
  const typeList = types.data ?? [];
  const groups = groupItems(items, typeList, true);

  const beginAdd = (options: TypeOption[]) => {
    if (options.length === 0) return;
    setSheet({ draft: emptyDraft(options[0].id), options, isAdd: true });
  };
  const beginEdit = (item: CVItem) =>
    setSheet({
      draft: draftFrom(item),
      options: typeOptionsFor(item.itemType, typeList),
      isAdd: false,
    });
  const commit = (draft: CVDraft, action: "save" | "delete") =>
    save.mutate(listWithChange(items, draft, action));

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <p className="text-muted-foreground text-sm">
        Add the details of your training, practice, and credentials. Everything
        here goes straight on your profile — edit or remove anything anytime.
      </p>
      {save.isError && (
        <p role="alert" className="text-destructive-foreground text-sm">
          {save.error.message}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{group.label}</SectionLabel>
            {!group.isTagLike && group.typeOptions.length > 0 && (
              <button
                type="button"
                onClick={() => beginAdd(group.typeOptions)}
                className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <Plus className="size-3.5" aria-hidden />
                Add
              </button>
            )}
          </div>
          {group.isTagLike ? (
            <TagSection
              group={group}
              types={typeList}
              onAdd={() =>
                beginAdd([
                  {
                    id: TAG_ADD_TYPE_ID,
                    name: friendlyName(TAG_ADD_TYPE_ID, typeList),
                  },
                ])
              }
              onDelete={(item) => commit(draftFrom(item), "delete")}
            />
          ) : group.items.length === 0 ? (
            <button
              type="button"
              onClick={() => beginAdd(group.typeOptions)}
              className="border-border text-muted-foreground hover:bg-muted/50 rounded-2xl border-[1.5px] border-dashed p-3 text-left text-sm"
            >
              Nothing here yet.
            </button>
          ) : (
            group.items.map((item) => (
              <ExperienceCard
                key={item.itemId}
                item={item}
                types={typeList}
                onEdit={() => beginEdit(item)}
              />
            ))
          )}
        </section>
      ))}

      {sheet && (
        <EditSheet
          key={sheet.draft.itemId ?? "new"}
          state={sheet}
          types={typeList}
          saving={save.isPending}
          onClose={() => setSheet(null)}
          onSave={(draft) => {
            commit(draft, "save");
            setSheet(null);
          }}
          onDelete={(draft) => {
            commit(draft, "delete");
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

/** The app's ExperienceEditSheet: type picker, one or two fields, years, current. */
function EditSheet({
  state,
  types,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  state: SheetState;
  types: CVItemType[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CVDraft) => void;
  onDelete: (draft: CVDraft) => void;
}) {
  const [draft, setDraft] = useState(state.draft);
  const spec = fieldSpec(draft.itemType);
  const typeName = friendlyName(draft.itemType, types);
  const canSave = draft.title.trim().length > 0 && !saving;
  const set = <K extends keyof CVDraft>(k: K, v: CVDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-background border-border/60 fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border p-6 shadow-2xl"
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) onSave(draft);
            }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-accent-alt text-[11px] font-bold tracking-wide uppercase">
                {state.isAdd ? `Add ${typeName}` : typeName}
              </p>
              <Dialog.Title className="text-xl font-bold">
                {state.isAdd ? "Add to your experience" : "Edit this entry"}
              </Dialog.Title>
            </div>

            {state.options.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  Type
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {state.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={o.id === draft.itemType}
                      onClick={() => set("itemType", o.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                        o.id === draft.itemType
                          ? "border-primary/50 bg-primary/15 text-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label={spec.primaryLabel}>
              <Input
                autoFocus
                value={draft.title}
                placeholder={spec.primaryPlaceholder}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>

            {!spec.isTagLike && (
              <>
                {spec.secondaryLabel && (
                  <Field label={spec.secondaryLabel}>
                    <Input
                      value={draft.description}
                      placeholder={spec.secondaryPlaceholder}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start year">
                    <Input
                      inputMode="numeric"
                      value={draft.start}
                      placeholder="2012"
                      onChange={(e) => set("start", e.target.value)}
                    />
                  </Field>
                  <Field label="End year">
                    <Input
                      inputMode="numeric"
                      value={draft.isCurrent ? "" : draft.end}
                      disabled={draft.isCurrent}
                      placeholder={draft.isCurrent ? "Present" : "2015"}
                      onChange={(e) => set("end", e.target.value)}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={draft.isCurrent}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        isCurrent: e.target.checked,
                        end: e.target.checked ? "" : d.end,
                      }))
                    }
                  />
                  I&apos;m still here / current
                </label>
              </>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button type="submit" variant="glow" disabled={!canSave}>
                {state.isAdd ? "Add to my profile" : "Save changes"}
              </Button>
              {!state.isAdd && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive-foreground"
                  onClick={() => onDelete(draft)}
                >
                  Delete this entry
                </Button>
              )}
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
