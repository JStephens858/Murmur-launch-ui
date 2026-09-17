"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/portal/current-user";
import { useMembers } from "@/lib/portal/groups";
import { useChangeParticipants } from "@/lib/portal/messages";
import { useUser } from "@/lib/portal/store";

import BackButton from "./back-button";
import { PortalError } from "./feed";
import { PersonRow } from "./group-details";
import PortalPageHeader from "./page-header";
import UserPicker from "./user-picker";

/**
 * DMGroupMembersView ("Group Participants"): everyone in the conversation,
 * remove with the app's confirmation, and an Add Members sheet. Removing
 * yourself is how you leave; the app never calls leavePostGroup for these.
 */
export default function ConversationMembers({
  postGroupId,
}: {
  postGroupId: string;
}) {
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const members = useMembers(postGroupId);
  const change = useChangeParticipants(postGroupId);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const ids = [
    ...new Set((members.data?.pages ?? []).flatMap((p) => p.userIds)),
  ];

  const confirmRemove = () => {
    if (!removing) return;
    const userId = removing;
    change.mutate(
      { userIds: [userId], add: false },
      {
        onSuccess: () => {
          setRemoving(null);
          if (userId === me?.userId) router.replace("/messages");
        },
      },
    );
  };

  return (
    <>
      <PortalPageHeader
        title="Group Participants"
        leading={<BackButton fallback={`/messages/${postGroupId}`} />}
        trailing={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add members"
            onClick={() => setAdding(true)}
          >
            <UserPlus className="size-5" />
          </Button>
        }
      />
      {members.status === "pending" && (
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      )}
      {members.isError && !members.data && (
        <PortalError error={members.error} retry={() => members.refetch()} />
      )}
      {members.isSuccess && ids.length === 0 && (
        <p className="text-muted-foreground px-4 py-8">
          There aren&apos;t any members yet
        </p>
      )}
      {ids.length > 0 && (
        <ul className="px-2 py-2">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <PersonRow userId={id} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove from group"
                onClick={() => setRemoving(id)}
              >
                <X className="text-destructive-foreground size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {change.isError && (
        <p className="text-destructive-foreground px-4 py-2 text-xs">
          {change.error instanceof Error
            ? change.error.message
            : "Couldn't update."}
        </p>
      )}

      <Dialog.Root
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="bg-background border-border/60 fixed top-1/2 left-1/2 z-50 flex w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold">
              Confirm Removal
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              Are you sure you want to remove{" "}
              {removing && <Handle userId={removing} />} from the group?
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                size="sm"
                disabled={change.isPending}
                onClick={confirmRemove}
              >
                Remove
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={adding}
        onOpenChange={(o) => {
          setAdding(o);
          if (!o) setToAdd([]);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="bg-background border-border/60 fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4">
              <div>
                <Dialog.Title className="text-lg font-semibold">
                  Add Members
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-sm">
                  Choose people to add
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <UserPicker selected={toAdd} onChange={setToAdd} exclude={ids} />
            </div>
            <div className="border-border/40 border-t p-3">
              <Button
                variant="glow"
                className="w-full"
                disabled={toAdd.length === 0 || change.isPending}
                onClick={() =>
                  change.mutate(
                    { userIds: toAdd, add: true },
                    { onSuccess: () => setAdding(false) },
                  )
                }
              >
                Add Members
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Handle({ userId }: { userId: string }) {
  const user = useUser(userId);
  return <>@{user?.username ?? "…"}</>;
}
