"use client";

import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  type FileItem,
  type ImageItem,
  type PollItem,
  uuid,
  type VideoItem,
} from "@/lib/portal/compose";
import { cn } from "@/lib/utils";

import { DocTextBelowEcgIcon, TextBadgeCheckmarkIcon } from "./icons";

/* Local object URLs and existing media hosts; plain <img>. */
/* eslint-disable @next/next/no-img-element */

/** Object URLs by blob, shared by everything showing that blob. */
const objectUrls = new WeakMap<Blob, { url: string; refs: number }>();

/**
 * An object URL for a blob, revoked once nothing shows the blob any more.
 * Reference-counted, with the revoke deferred a tick: React mounts twice in
 * development, and revoking in the first cleanup would break the URL the
 * second mount is still using.
 */
export function useObjectUrl(blob: Blob | null | undefined) {
  const url = useMemo(() => {
    if (!blob) return null;
    let entry = objectUrls.get(blob);
    if (!entry) {
      entry = { url: URL.createObjectURL(blob), refs: 0 };
      objectUrls.set(blob, entry);
    }
    return entry.url;
  }, [blob]);
  useEffect(() => {
    const entry = blob ? objectUrls.get(blob) : undefined;
    if (!blob || !entry) return;
    entry.refs++;
    return () => {
      entry.refs--;
      setTimeout(() => {
        if (entry.refs === 0 && objectUrls.get(blob) === entry) {
          URL.revokeObjectURL(entry.url);
          objectUrls.delete(blob);
        }
      }, 0);
    };
  }, [blob]);
  return url;
}

/** The box every item sits in: its controls float top-right. */
export function ItemFrame({
  label,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  children,
}: {
  label: string;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const btn =
    "text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <section
      aria-label={label}
      className="border-border/60 group/item relative rounded-2xl border px-3 pt-2 pb-3"
    >
      <div className="mb-1 flex items-center gap-0.5">
        <span className="text-muted-foreground mr-auto text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        <button
          type="button"
          className={btn}
          onClick={onMoveUp}
          disabled={disabled || !onMoveUp}
          aria-label={`Move ${label.toLowerCase()} up`}
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          className={btn}
          onClick={onMoveDown}
          disabled={disabled || !onMoveDown}
          aria-label={`Move ${label.toLowerCase()} down`}
        >
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          className={cn(btn, "hover:text-destructive-foreground")}
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${label.toLowerCase()}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Caption({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Add a Caption"
      aria-label="Caption"
      className="mt-2"
    />
  );
}

export function ImageEditor({
  item,
  onChange,
  disabled,
}: {
  item: ImageItem;
  onChange: (next: ImageItem) => void;
  disabled?: boolean;
}) {
  const local = useObjectUrl(item.file);
  const src = local ?? item.uploaded?.previewUrl ?? null;
  return (
    <>
      {src ? (
        <img
          src={src}
          alt=""
          className="bg-muted max-h-[420px] w-full rounded-xl object-contain"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-40 items-center justify-center rounded-xl text-sm">
          Photo
        </div>
      )}
      <Caption
        value={item.caption}
        onChange={(caption) => onChange({ ...item, caption })}
        disabled={disabled}
      />
    </>
  );
}

export function VideoEditor({
  item,
  onChange,
  canPickPoster,
  disabled,
}: {
  item: VideoItem;
  onChange: (next: VideoItem) => void;
  /** Admins pick the poster frame; everyone else gets the first frame. */
  canPickPoster: boolean;
  disabled?: boolean;
}) {
  const local = useObjectUrl(item.file);
  const src = local ?? item.uploaded?.previewUrl ?? null;
  const video = useRef<HTMLVideoElement>(null);
  const [posterSet, setPosterSet] = useState(false);
  const isNew = !item.uploaded;

  return (
    <>
      {src ? (
        <video
          ref={video}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="max-h-[420px] w-full rounded-xl bg-black"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-40 items-center justify-center rounded-xl text-sm">
          Video
        </div>
      )}
      {canPickPoster && isNew && local && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const v = video.current;
              if (!v || !v.duration) return;
              onChange({
                ...item,
                posterPercent: Math.min(
                  1,
                  Math.max(0, v.currentTime / v.duration),
                ),
              });
              setPosterSet(true);
            }}
            className="text-primary font-medium hover:underline disabled:opacity-50"
          >
            Use current position as poster frame
          </button>
          {(posterSet || item.posterPercent > 0) && (
            <span className="text-muted-foreground text-xs tabular-nums">
              at {Math.round(item.posterPercent * 100)}%
            </span>
          )}
        </div>
      )}
      <Caption
        value={item.caption}
        onChange={(caption) => onChange({ ...item, caption })}
        disabled={disabled}
      />
    </>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileEditor({
  item,
  onChange,
  disabled,
}: {
  item: FileItem;
  onChange: (next: FileItem) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="bg-muted/60 flex items-center gap-3 rounded-xl px-3 py-3">
        <DocTextBelowEcgIcon className="text-primary size-7 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{item.filename}</span>
          {item.file && (
            <span className="text-muted-foreground text-xs">
              {formatBytes(item.file.size)}
            </span>
          )}
        </span>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.allowDownload}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...item, allowDownload: e.target.checked })
          }
          className="accent-primary size-4"
        />
        Allow users to download file
      </label>
      <Caption
        value={item.caption}
        onChange={(caption) => onChange({ ...item, caption })}
        disabled={disabled}
      />
    </>
  );
}

export function PollEditor({
  item,
  onChange,
  disabled,
}: {
  item: PollItem;
  onChange: (next: PollItem) => void;
  disabled?: boolean;
}) {
  const setOption = (id: string, text: string) =>
    onChange({
      ...item,
      options: item.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TextBadgeCheckmarkIcon className="text-primary size-5 shrink-0" />
        <Input
          value={item.prompt}
          onChange={(e) => onChange({ ...item, prompt: e.target.value })}
          disabled={disabled}
          placeholder="Enter your prompt"
          aria-label="Poll prompt"
          className="font-medium"
        />
      </div>
      <ol className="flex flex-col gap-2 pl-7">
        {item.options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <Input
              value={o.text}
              onChange={(e) => setOption(o.id, e.target.value)}
              disabled={disabled}
              placeholder="Enter an option"
              aria-label={`Option ${i + 1}`}
            />
            <button
              type="button"
              disabled={disabled || item.options.length <= 1}
              onClick={() =>
                onChange({
                  ...item,
                  options: item.options.filter((x) => x.id !== o.id),
                })
              }
              aria-label={`Remove option ${i + 1}`}
              className="text-muted-foreground hover:text-foreground rounded-full border p-1 disabled:opacity-30"
            >
              <Minus className="size-3.5" />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            ...item,
            options: [...item.options, { id: uuid(), text: "" }],
          })
        }
        className="text-primary ml-7 flex items-center gap-1 self-start text-sm font-medium hover:underline"
      >
        <Plus className="size-4" />
        Add option
      </button>
    </div>
  );
}
