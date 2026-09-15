"use client";

import { formatCount } from "@/lib/format";
import { useCurrentUser } from "@/lib/portal/current-user";

import type { PortalNavItem } from "./nav";

/**
 * Unread count pinned to a nav icon's corner, like the app's pink capsule
 * on its menu rows. Renders nothing at zero or while the profile loads.
 */
export default function NavBadge({ item }: { item: PortalNavItem }) {
  const { data: user } = useCurrentUser();
  const count = item.badge ? (user?.[item.badge] ?? 0) : 0;
  if (!count) return null;
  return (
    <span
      className="bg-primary text-primary-foreground absolute -top-1 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold"
      aria-label={`${count} unread`}
    >
      {formatCount(count)}
    </span>
  );
}
