import { cn } from "@/lib/utils";

import { MurmurLogoComboIcon } from "./icons";

/* Group icons are user uploads on the API's media hosts; plain <img>. */
/* eslint-disable @next/next/no-img-element */

/**
 * A group's icon, as GroupCellView reads iconUrl: an http(s) URL is an
 * image, anything else non-empty is an emoji, nothing is the app's logo.
 */
export default function GroupIcon({
  iconUrl,
  className,
}: {
  iconUrl: string | null | undefined;
  className?: string;
}) {
  const base = cn(
    "bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
    className,
  );
  if (iconUrl?.startsWith("http")) {
    return (
      <span className={base} aria-hidden>
        <img
          src={iconUrl}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }
  if (iconUrl) {
    return (
      <span className={cn(base, "text-2xl")} aria-hidden>
        {iconUrl}
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        "[--icon-primary:var(--color-primary)] [--icon-secondary:#fff]",
      )}
      aria-hidden
    >
      <MurmurLogoComboIcon className="size-8" />
    </span>
  );
}
