import type { PortalUser } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

/* Profile pictures come from the API's media hosts, which aren't in
   next/image's remotePatterns; plain <img> as elsewhere on the site. */
/* eslint-disable @next/next/no-img-element */

/** The letter shown when someone has no picture. */
export function avatarInitial(user: PortalUser | undefined) {
  return (user?.displayName || user?.username || "?").charAt(0).toUpperCase();
}

export default function Avatar({
  user,
  className,
}: {
  user: PortalUser | undefined;
  className?: string;
}) {
  const src = user?.profilePicThumbnailUrl ?? user?.profilePicMediumUrl ?? null;
  const initial = avatarInitial(user);
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold",
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        initial
      )}
    </span>
  );
}
