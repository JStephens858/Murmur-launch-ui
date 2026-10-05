"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The portal pages this browser tab has visited since it loaded, in order.
 * Module-level on purpose: it survives client-side navigation and resets
 * on a hard load, which is exactly when there is no in-app page to return
 * to. `history.length` can't tell those apart (a link from outside the
 * site would send the reader back out). Consecutive duplicates are
 * dropped so React's double-run of effects in development doesn't count
 * one page twice.
 */
const visited: string[] = [];

/** Mounted once in the portal layout; records route changes. */
export function PortalNavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (visited.at(-1) !== pathname) visited.push(pathname);
  }, [pathname]);
  return null;
}

/** Navigates back the way BackButton does, for pages that leave on their own. */
export function useGoBack(fallback = "/feed") {
  const router = useRouter();
  return () => (visited.length > 1 ? router.back() : router.push(fallback));
}

/**
 * Returns to the page that opened this one — feed, explore, notifications,
 * whichever — or to the feed when the page was opened directly.
 */
export default function BackButton({
  fallback = "/feed",
}: {
  fallback?: string;
}) {
  const goBack = useGoBack(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      className="hover:bg-foreground/10 -ml-2 flex size-9 items-center justify-center rounded-full"
      aria-label="Back"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
