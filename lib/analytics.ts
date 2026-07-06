"use client";

import mixpanel from "mixpanel-browser";

/**
 * Mixpanel wrapper. Every helper is a no-op until
 * NEXT_PUBLIC_MIXPANEL_TOKEN is set, so the site works without analytics
 * configured (local dev, preview builds).
 */

const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function ready(): boolean {
  if (initialized) return true;
  if (!token || typeof window === "undefined") return false;
  mixpanel.init(token, {
    // Pageviews are tracked manually from <Analytics /> so SPA route
    // changes are counted, not just full document loads.
    track_pageview: false,
    persistence: "localStorage",
  });
  initialized = true;
  return true;
}

/** Track a pageview for the current URL (call after route changes). */
export function trackPageview() {
  if (!ready()) return;
  mixpanel.track_pageview();
}

/** Track a named event with optional properties. */
export function track(event: string, props?: Record<string, unknown>) {
  if (!ready()) return;
  mixpanel.track(event, props);
}
