import type { Metadata } from "next";

import StatusPanel from "@/components/legacy/status-panel";
import { guardLegacyAction, logLegacyOutcome } from "@/lib/legacy-guard";
import { parseAcceptReengagement } from "@/lib/legacy-urls";
import {
  mutationTimeoutMs,
  webBasedAcceptReengagementPosts,
} from "@/lib/murmur-legacy";

/**
 * `/acceptReengagementPosts/<YYYY-MM-DD>/<username>` — the accept link in the
 * reengagement email.
 *
 * Two changes from legacy, both corrections:
 *
 *  - The mutation is awaited. Legacy fired it without awaiting and immediately
 *    replied `OK <date> <user>`, so a failed accept was indistinguishable from a
 *    successful one. This page reports what actually happened.
 *  - It runs behind guardLegacyAction, because this endpoint changes state from
 *    an unauthenticated GET and its URL contains no secret at all — just a date
 *    and a username, both guessable. See lib/legacy-guard.ts.
 *
 * Legacy also called res.send() followed by res.sendStatus(200), so every one of
 * these requests logged ERR_HTTP_HEADERS_SENT. The response body changes from
 * plain text to HTML here; nothing machine-reads it, but it's worth confirming
 * with whoever generates these emails.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reengagement posts",
  robots: { index: false, follow: false },
};

export default async function AcceptReengagementRoute({
  params,
}: {
  params: Promise<{ args: string[] }>;
}) {
  const { args } = await params;
  const path = `/acceptReengagementPosts/${args.join("/")}`;
  const parsed = parseAcceptReengagement(path);

  if (!parsed) {
    logLegacyOutcome(path, "error", "unparseable arguments");
    return (
      <StatusPanel
        tone="bad-link"
        title="This link isn't readable"
        description="The link looks incomplete — email clients sometimes split long links across lines. Try opening it again from the original email."
      />
    );
  }

  const { runMutation, reason } = await guardLegacyAction(path);

  // A skipped mutation still renders the success page: the visitor may well be
  // the second, human request, and a scary error would be wrong either way.
  if (!runMutation) {
    return (
      <StatusPanel
        tone="success"
        title="Your posts are on the way"
        description="We've got it — the posts from that digest are being added to your feed. Open the MurmurMD app to see them."
        subdescription={
          reason === "replay"
            ? "Looks like this link was already opened, so nothing was done twice."
            : undefined
        }
      />
    );
  }

  let accepted = false;
  try {
    accepted = await webBasedAcceptReengagementPosts(
      parsed.dateStr,
      parsed.username,
      AbortSignal.timeout(mutationTimeoutMs()),
    );
    logLegacyOutcome(path, accepted ? "success" : "failure");
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logLegacyOutcome(
      path,
      timedOut ? "timeout" : "error",
      error instanceof Error ? error.message : String(error),
    );
  }

  return accepted ? (
    <StatusPanel
      tone="success"
      title="Your posts are on the way"
      description="The posts from that digest are being added to your feed. Open the MurmurMD app to see them."
    />
  ) : (
    <StatusPanel
      tone="failure"
      title="We couldn't add those posts"
      description="Something went wrong on our end, or this link has already been used. Open the MurmurMD app and the posts will be waiting in your feed either way."
    />
  );
}
