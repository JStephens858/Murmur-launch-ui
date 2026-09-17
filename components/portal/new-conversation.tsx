"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCreateConversation } from "@/lib/portal/messages";

import BackButton from "./back-button";
import PortalPageHeader from "./page-header";
import UserPicker from "./user-picker";

/**
 * NewDirectMessageView: pick people, write the first message, Send. The
 * backend returns the existing conversation for the same members, so this
 * doubles as "message these people". The compose page is replaced by the
 * conversation so back goes to the list.
 */
export default function NewConversation() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const create = useCreateConversation();

  return (
    <>
      <PortalPageHeader
        title="New Group Chat"
        leading={<BackButton fallback="/messages" />}
      />
      <p className="text-muted-foreground px-4 pt-3 text-sm font-medium">
        Include these users:
      </p>
      <UserPicker selected={selected} onChange={setSelected} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { memberUserIds: selected, text },
            {
              onSuccess: (postGroupId) =>
                router.replace(`/messages/${postGroupId}`),
            },
          );
        }}
        className="border-border/40 bg-background sticky bottom-0 flex items-end gap-2 border-t px-3 py-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter your message"
          aria-label="Message"
          rows={1}
          className="border-border/60 bg-card focus-visible:ring-ring max-h-40 min-h-11 flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <Button
          type="submit"
          variant="glow"
          size="sm"
          disabled={!text.trim() || selected.length === 0 || create.isPending}
        >
          Send
        </Button>
      </form>
      {create.isError && (
        <p className="text-destructive-foreground px-4 py-2 text-xs">
          {create.error instanceof Error
            ? create.error.message
            : "Couldn't start the conversation."}
        </p>
      )}
    </>
  );
}
