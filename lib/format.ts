export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatVideoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Legacy's truncateString from Murmur-express/staticServer.js, used for the
 * /post link-preview title and description. Kept identical (append "..." only
 * when the string was actually longer) so previews already cached by Slack and
 * X don't shift when the port goes live.
 */
export function truncateString(str: string, num: number): string {
  if (str.length <= num) {
    return str;
  }
  return str.slice(0, num) + "...";
}

export function formatViews(views: number): string {
  if (views >= 1000) {
    return `${(views / 1000).toFixed(views >= 10000 ? 0 : 1)}k views`;
  }
  return `${views} view${views === 1 ? "" : "s"}`;
}

/**
 * Compact age for feed rows: "now", "5m", "3h", "2d", then "Mar 4" and
 * "Mar 4, 2025" once it's older than a year. Matches what X shows on a card.
 */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const secs = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (secs < 60) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 86400 * 7) return `${Math.floor(secs / 86400)}d`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "1.2K", "34K", "2.1M" — counter style for likes and comments. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000)
    return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
