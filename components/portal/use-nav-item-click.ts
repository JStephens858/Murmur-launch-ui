"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { useCurrentUser } from "@/lib/portal/current-user";

import type { PortalNavItem } from "./nav";

/**
 * Click handling for the primary nav, the way the app's tab bar behaves:
 * tapping the tab you are already on scrolls back to the top instead of
 * navigating, and if its badge shows unread items, reloads the list too.
 * Returns a handler per item; undefined when the item is not the current
 * route, so its Link navigates as usual.
 */
export function useNavItemClick() {
  const pathname = usePathname();
  const client = useQueryClient();
  const { data: user } = useCurrentUser();
  return (item: PortalNavItem) => {
    if (pathname !== item.href) return undefined;
    return (event: MouseEvent<HTMLAnchorElement>) => {
      // Plain left clicks only; modified clicks open a new tab as usual.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      const unread = item.badge ? (user?.[item.badge] ?? 0) : 0;
      if (unread > 0) item.reload?.(client);
    };
  };
}
