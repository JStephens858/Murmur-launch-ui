"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/portal/current-user";
import {
  joinAffordance,
  useJoinGroup,
  useRequestAccess,
} from "@/lib/portal/groups";
import type { PortalPostGroup } from "@/lib/portal/types";

/**
 * Join / Leave / Request Access, per GroupJoinButton.swift. Leave is only
 * offered in the long form, i.e. on the details page — never from the
 * list — and, as in the app, has no confirmation.
 */
export default function GroupJoinButton({
  group,
  longForm = false,
}: {
  group: PortalPostGroup;
  longForm?: boolean;
}) {
  const { data: user } = useCurrentUser();
  const join = useJoinGroup();
  const affordance = joinAffordance(group, user, { allowLeave: longForm });

  if (affordance === "none") return null;
  if (affordance === "request") return <RequestAccess group={group} />;

  const joining = affordance === "join";
  return (
    <Button
      variant={joining ? "glow" : "outline"}
      size="sm"
      disabled={join.isPending}
      onClick={() =>
        join.mutate({ postGroupId: group.postGroupId, join: joining })
      }
    >
      {joining
        ? longForm
          ? "Join this group"
          : "Join"
        : longForm
          ? "Leave this group"
          : "Leave"}
    </Button>
  );
}

function RequestAccess({ group }: { group: PortalPostGroup }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRequestAccess();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) request.reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="glow" size="sm">
          Request Access
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="bg-background border-border/60 fixed top-1/2 left-1/2 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border p-6 shadow-2xl focus:outline-none">
          {sent ? (
            <>
              <Dialog.Title className="text-lg font-semibold">
                Message sent
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                Someone will review your request as soon as possible. You will
                receive a notification in your notification center at that time.
              </Dialog.Description>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button variant="glow" size="sm">
                    OK
                  </Button>
                </Dialog.Close>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-semibold">
                {group.groupName}
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                To become a member of a private group, you need to be added by
                one of the group&apos;s moderators. You can enter a message
                below to explain your interest in the group.
              </Dialog.Description>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                aria-label="Message to the moderators"
                className="border-border/60 bg-card focus-visible:ring-ring w-full rounded-lg border p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
              {request.isError && (
                <p className="text-destructive-foreground text-sm">
                  {request.error instanceof Error
                    ? request.error.message
                    : "Couldn't send."}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  variant="glow"
                  size="sm"
                  disabled={request.isPending}
                  onClick={() =>
                    request.mutate(
                      { postGroupId: group.postGroupId, message },
                      { onSuccess: () => setSent(true) },
                    )
                  }
                >
                  Send
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
