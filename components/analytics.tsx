"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { trackPageview } from "@/lib/analytics";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackPageview();
  }, [pathname, searchParams]);

  return null;
}

/** Fires a Mixpanel pageview on load and on every App Router navigation. */
export default function Analytics() {
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
