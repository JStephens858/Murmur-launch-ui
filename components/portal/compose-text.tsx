"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  firstCompleteUrl,
  type TextItem,
  useLinkPreview,
  useTokenSearch,
} from "@/lib/portal/compose";
import { useHashtag, useUser } from "@/lib/portal/store";
import { cn } from "@/lib/utils";

import Avatar from "./avatar";

/* Open Graph images come from arbitrary sites; plain <img>. */
/* eslint-disable @next/next/no-img-element */

interface Token {
  sigil: "@" | "#";
  text: string;
  /** Where the sigil sits in the text. */
  start: number;
}

/**
 * The @ or # word the caret is in, as PostTextEntry detects it: the sigil
 * must start the text or follow whitespace or one of |[]{}().
 */
function tokenAt(text: string, caret: number): Token | null {
  const m = text.slice(0, caret).match(/(^|[\s|[\]{}()])([@#])([\w.-]*)$/);
  if (!m) return null;
  const sigil = m[2] as "@" | "#";
  return { sigil, text: m[3], start: caret - m[3].length - 1 };
}

function Suggestion({
  domId,
  sigil,
  id,
  active,
  onPick,
}: {
  domId: string;
  sigil: "@" | "#";
  id: string;
  active: boolean;
  onPick: (value: string) => void;
}) {
  const user = useUser(sigil === "@" ? id : null);
  const tag = useHashtag(sigil === "#" ? id : null);
  const value = sigil === "@" ? user?.username : tag?.hashtag;
  if (!value) return null;
  return (
    <li id={domId} role="option" aria-selected={active}>
      <button
        type="button"
        // Keep focus (and the caret) in the textarea.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(value)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
          active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
        )}
      >
        {sigil === "@" ? (
          <>
            <Avatar user={user} className="size-7" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-medium">
                {user?.displayName || user?.username}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                @{user?.username}
              </span>
            </span>
          </>
        ) : (
          <span className="font-medium">#{tag?.hashtag}</span>
        )}
      </button>
    </li>
  );
}

export function LinkPreviewCard({
  preview,
  onDismiss,
}: {
  preview: {
    title: string | null;
    image: string | null;
    description: string | null;
    baseUrl: string | null;
  };
  onDismiss?: () => void;
}) {
  return (
    <div className="border-border/60 relative flex overflow-hidden rounded-xl border">
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="bg-muted size-24 shrink-0 object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2 pr-9">
        {preview.baseUrl && (
          <span className="text-muted-foreground truncate text-xs">
            {preview.baseUrl}
          </span>
        )}
        {preview.title && (
          <span className="line-clamp-2 text-sm font-medium">
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {preview.description}
          </span>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Remove link preview"
          className="bg-background/80 hover:bg-background absolute top-1.5 right-1.5 rounded-full p-1"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * A text item: a growing textarea with @mention and #hashtag suggestions
 * and the first complete link turned into a preview card.
 */
export default function ComposeText({
  item,
  postGroupId,
  onChange,
  autoFocus,
  disabled,
}: {
  item: TextItem;
  postGroupId: string;
  onChange: (next: TextItem) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = useState<Token | null>(null);
  const [active, setActive] = useState(0);
  const search = useTokenSearch(
    token ? { sigil: token.sigil, text: token.text } : null,
    postGroupId,
  );
  const suggestions = token ? (search.data ?? []).slice(0, 8) : [];

  // Grow with the text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.text]);

  // Link preview: look up the first complete URL unless it was dismissed.
  const url = firstCompleteUrl(item.text);
  const wanted = url && url !== item.dismissedLink ? url : null;
  const preview = useLinkPreview(item.link?.url === wanted ? null : wanted);
  useEffect(() => {
    if (!wanted) {
      if (item.link) onChange({ ...item, link: null });
      return;
    }
    if (preview.data !== undefined && item.link?.url !== wanted) {
      onChange({ ...item, link: preview.data });
    }
    // onChange and item change every render; key off the inputs that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, preview.data]);

  const readToken = () => {
    const el = ref.current;
    if (!el) return;
    setToken(tokenAt(el.value, el.selectionStart));
    setActive(0);
  };

  // Where the caret goes after a suggestion is inserted; applied once the
  // new text has rendered, before the next keystroke can land.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [item.text]);

  const pick = (value: string) => {
    const el = ref.current;
    if (!el) return;
    // Read the token from the live field, not state: typing may be ahead.
    const live = tokenAt(el.value, el.selectionStart);
    if (!live) return;
    const after = el.value.slice(el.selectionStart);
    const insert = `${live.sigil}${value}${after.startsWith(" ") ? "" : " "}`;
    const text = el.value.slice(0, live.start) + insert + after;
    pendingCaret.current = live.start + insert.length;
    onChange({ ...item, text });
    setToken(null);
    el.focus();
  };

  return (
    <div className="relative flex flex-col gap-2">
      <textarea
        ref={ref}
        value={item.text}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={item.isTitle ? 1 : 3}
        placeholder={item.isTitle ? "Title" : "Enter your message"}
        aria-label={item.isTitle ? "Post title" : "Message"}
        onChange={(e) => {
          onChange({ ...item, text: e.target.value });
          readToken();
        }}
        onSelect={readToken}
        onBlur={() => setToken(null)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            const id = suggestions[active];
            if (!id) return;
            e.preventDefault();
            // Suggestion rows resolve their own value; click the active one.
            document
              .getElementById(`suggest-${item.id}-${active}`)
              ?.querySelector("button")
              ?.click();
          } else if (e.key === "Escape") {
            setToken(null);
          }
        }}
        className={cn(
          "placeholder:text-muted-foreground w-full resize-none bg-transparent leading-relaxed outline-none",
          item.isTitle ? "text-lg font-semibold" : "text-[15px]",
        )}
      />
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className="bg-popover border-border absolute top-full left-0 z-40 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border py-1 shadow-lg"
        >
          {suggestions.map((id, i) => (
            <Suggestion
              key={id}
              domId={`suggest-${item.id}-${i}`}
              sigil={token!.sigil}
              id={id}
              active={i === active}
              onPick={pick}
            />
          ))}
        </ul>
      )}
      {item.link && (
        <LinkPreviewCard
          preview={item.link}
          onDismiss={
            disabled
              ? undefined
              : () =>
                  onChange({
                    ...item,
                    link: null,
                    dismissedLink: item.link!.url,
                  })
          }
        />
      )}
    </div>
  );
}
