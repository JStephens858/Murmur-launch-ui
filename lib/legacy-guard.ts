/**
 * Safety layer for the ported legacy action endpoints.
 *
 * `/doNotPromote/…` and `/acceptReengagementPosts/…` change state from an
 * unauthenticated GET, because that is what the links already sent out do. Plenty
 * of things fetch a URL without a human deciding to: Outlook Safe Links and
 * corporate mail gateways scan links in email, chat clients unfurl them, and
 * browsers speculatively prefetch. Legacy fired its mutation for every one of
 * those and logged nothing, so a misfire was invisible.
 *
 * The URLs cannot change, so this narrows what fires without touching the
 * contract:
 *   - prefetch/preview request headers  -> render, don't mutate
 *   - known crawler and scanner agents  -> render, don't mutate
 *   - the same URL again within the TTL -> render, don't mutate
 *
 * The UA list and the prefetch headers are both trivially spoofable, so this
 * reduces accidents, not attacks. The non-GET guard in proxy.ts is the part that
 * closes a real hole (Next aliases HEAD to the GET handler). A confirmation
 * interstitial is the only complete fix and is deliberately not implemented
 * here — it would change the one-click behaviour of links already in the wild.
 */

import { headers } from "next/headers";

import { trustedClientIp } from "./client-ip";

/** Window in which a repeat of the identical URL is treated as a replay. */
const DEDUPE_TTL_MS = 10 * 60 * 1000;

/** Cap on the dedupe map, so a URL flood can't grow it without bound. */
const DEDUPE_MAX_ENTRIES = 5000;

/**
 * Per-process, so under a multi-instance load balancer a scanner and the human
 * can land on different instances and both get through. That's acceptable: it
 * catches the common case (scanner and click on the same instance), and the
 * backend mutations should be idempotent regardless. Worth confirming that they
 * are rather than assuming it.
 */
const recentlySeen = new Map<string, number>();

function pruneExpired(now: number): void {
  for (const [key, expiry] of recentlySeen) {
    if (expiry <= now) recentlySeen.delete(key);
  }
}

function isReplay(key: string): boolean {
  const now = Date.now();
  const expiry = recentlySeen.get(key);
  if (expiry !== undefined && expiry > now) return true;
  if (recentlySeen.size >= DEDUPE_MAX_ENTRIES) pruneExpired(now);
  // Still full after pruning: drop the oldest insertion (Map preserves order).
  if (recentlySeen.size >= DEDUPE_MAX_ENTRIES) {
    const oldest = recentlySeen.keys().next().value;
    if (oldest !== undefined) recentlySeen.delete(oldest);
  }
  recentlySeen.set(key, now + DEDUPE_TTL_MS);
  return false;
}

/**
 * Agents that fetch links without a person clicking. Matched case-insensitively
 * as substrings of the UA.
 */
const AUTOMATED_AGENTS = [
  "bot",
  "crawler",
  "spider",
  "slurp",
  "preview",
  "scan",
  "monitor",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "headlesschrome",
  "slackbot",
  "twitterbot",
  "facebookexternalhit",
  "whatsapp",
  "discordbot",
  "telegrambot",
  "linkedinbot",
  "bingpreview",
  "skypeuripreview",
  "microsoftpreview",
  "office",
  "outlook",
  "proofpoint",
  "mimecast",
  "barracuda",
  "symantec",
] as const;

function looksAutomated(userAgent: string | null): boolean {
  if (!userAgent) return true; // no UA at all is not a browser
  const ua = userAgent.toLowerCase();
  return AUTOMATED_AGENTS.some((needle) => ua.includes(needle));
}

/**
 * Prefetch and link-preview signals. `Sec-Purpose` is the current standard;
 * `Purpose` and `X-Purpose` are the older Chrome/Safari spellings.
 */
function looksPrefetched(h: Headers): boolean {
  const signals = [
    h.get("sec-purpose"),
    h.get("purpose"),
    h.get("x-purpose"),
    h.get("x-moz"),
  ];
  return signals.some(
    (value) =>
      value !== null && /prefetch|preview|prerender/i.test(value),
  );
}

export interface GuardDecision {
  runMutation: boolean;
  /** Why the mutation was skipped; "ok" when it should run. */
  reason: "ok" | "prefetch" | "automated-agent" | "replay";
}

/**
 * Decides whether a legacy action endpoint should perform its mutation, and
 * logs the decision. Call once per request, before mutating.
 *
 * `dedupeKey` should identify the action, normally the pathname — that is what
 * makes a scanner's fetch and the subsequent human click collapse into one.
 */
export async function guardLegacyAction(
  dedupeKey: string,
): Promise<GuardDecision> {
  const h = await headers();
  const userAgent = h.get("user-agent");

  let decision: GuardDecision;
  if (looksPrefetched(h)) {
    decision = { runMutation: false, reason: "prefetch" };
  } else if (looksAutomated(userAgent)) {
    decision = { runMutation: false, reason: "automated-agent" };
  } else if (isReplay(dedupeKey)) {
    decision = { runMutation: false, reason: "replay" };
  } else {
    decision = { runMutation: true, reason: "ok" };
  }

  console.info(
    JSON.stringify({
      event: "legacy-action",
      path: dedupeKey,
      ran: decision.runMutation,
      reason: decision.reason,
      ip: await trustedClientIp(),
      xff: h.get("x-forwarded-for"),
      ua: userAgent,
    }),
  );

  return decision;
}

/** Records the result of an action that ran, so outcomes are greppable too. */
export function logLegacyOutcome(
  path: string,
  outcome: "success" | "failure" | "error" | "timeout",
  detail?: string,
): void {
  console.info(
    JSON.stringify({
      event: "legacy-action-outcome",
      path,
      outcome,
      ...(detail ? { detail } : {}),
    }),
  );
}

/** Test seam: clears the dedupe map between verification runs. */
export function __resetDedupeForTests(): void {
  recentlySeen.clear();
}
