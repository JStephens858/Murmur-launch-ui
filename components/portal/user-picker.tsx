"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { useCurrentUser } from "@/lib/portal/current-user";
import { useContacts, useUserSearch } from "@/lib/portal/messages";
import { useUser } from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";

function Row({
  userId,
  selected,
  disabled,
  onToggle,
}: {
  userId: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const user = useUser(userId);
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        disabled={disabled}
        onClick={onToggle}
        className="hover:bg-foreground/[0.03] flex w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
          aria-hidden
        >
          {selected && <Check className="size-4" />}
        </span>
        <Avatar user={user} className="size-9" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">
            {user?.displayName || user?.username || "…"}
          </span>
          {user?.username && (
            <span className="text-muted-foreground truncate text-sm">
              @{user.username}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * The recipient picker shared by New Group Chat and Add Members: your
 * followers and following by default, or a search from three characters,
 * each row a checkbox. `exclude` hides people already in the conversation.
 */
export default function UserPicker({
  selected,
  onChange,
  exclude = [],
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
}) {
  const [text, setText] = useState("");
  const { data: me } = useCurrentUser();
  const contacts = useContacts(me?.userId);
  const search = useUserSearch(text);
  const searching = text.replace(/[@“”"]/g, "").trim().length >= 3;
  const ids = (searching ? (search.data ?? []) : (contacts.data ?? [])).filter(
    (id) => !exclude.includes(id),
  );
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by name or username"
          aria-label="Search people"
          className="border-border/60 bg-card focus-visible:ring-ring w-full rounded-full border px-4 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      {searching && search.isSuccess && (
        <p className="text-muted-foreground px-4 py-1 text-xs">
          {ids.length === 0
            ? "No search results found"
            : `${ids.length} ${ids.length === 1 ? "person matches" : "people match"} “${text.trim()}”`}
        </p>
      )}
      {(searching ? search.isPending : contacts.isPending) && (
        <p className="text-muted-foreground px-4 py-2 text-sm">Loading...</p>
      )}
      <ul>
        {ids.map((id) => (
          <Row
            key={id}
            userId={id}
            selected={selected.includes(id)}
            disabled={id === me?.userId}
            onToggle={() => toggle(id)}
          />
        ))}
      </ul>
    </div>
  );
}
