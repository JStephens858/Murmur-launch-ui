import Link from "next/link";

import { cn } from "@/lib/utils";

import { MurmurLogoComboIcon, PlusIcon } from "./icons";
import { composeHref } from "./nav";

/**
 * The app's "add a murmur" button (AddMurmurIcon2 in the iOS app): a circle
 * with a 4pt accent ring on a translucent fill, holding a bold "+" and the
 * two-tone logo. The mark is the same everywhere; the sidebar adds a "Post"
 * label beside it on wide screens where X would show a labelled button.
 */
export function PostMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-primary bg-card/80 flex size-16 shrink-0 items-center justify-center rounded-full border-4 shadow-md backdrop-blur-sm",
        "[--icon-primary:var(--color-primary)] [--icon-secondary:#fff]",
        className,
      )}
    >
      <PlusIcon className="text-primary -mr-0.5 size-5" />
      <MurmurLogoComboIcon className="size-9" />
    </span>
  );
}

export function PostButton({
  className,
  showLabel = false,
}: {
  className?: string;
  /** "always" shows the label at every width (the phone drawer). */
  showLabel?: boolean | "always";
}) {
  return (
    <Link
      href={composeHref}
      aria-label="Post"
      className={cn(
        "group flex items-center gap-3 rounded-full transition-colors",
        showLabel && "hover:bg-foreground/10 xl:pr-6",
        className,
      )}
    >
      <PostMark className="transition-transform group-hover:scale-105 group-active:scale-95" />
      {showLabel && (
        <span
          className={cn(
            "text-lg font-bold",
            showLabel === "always" ? "inline" : "hidden xl:inline",
          )}
        >
          Post
        </span>
      )}
    </Link>
  );
}
