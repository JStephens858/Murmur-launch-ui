import type { Metadata } from "next";

import StatusPanel from "@/components/legacy/status-panel";
import { guardLegacyAction, logLegacyOutcome } from "@/lib/legacy-guard";
import { parseDoNotPromote } from "@/lib/legacy-urls";
import {
  mutationTimeoutMs,
  webBasedAdminFlagSetDoNotPromote,
} from "@/lib/murmur-legacy";

/**
 * `/doNotPromote/<postId>/<magicCookie>/<username>` — the admin link that flags
 * a post as not-to-be-promoted.
 *
 * Same two corrections as /acceptReengagementPosts: the mutation is awaited so
 * the page can report the real outcome, and it runs behind guardLegacyAction
 * because it changes state from an unauthenticated GET. Here the only secret is
 * the 10-character magic cookie in the URL, which link scanners in the recipient's
 * mail path get to see as readily as the recipient does.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post promotion",
  robots: { index: false, follow: false },
};

export default async function DoNotPromoteRoute({
  params,
}: {
  params: Promise<{ args: string[] }>;
}) {
  const { args } = await params;
  const path = `/doNotPromote/${args.join("/")}`;
  const parsed = parseDoNotPromote(path);

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

  if (!runMutation) {
    return (
      <StatusPanel
        tone="success"
        title="This post won't be promoted"
        description="The post is flagged. No further action needed."
        subdescription={
          reason === "replay"
            ? "Looks like this link was already opened, so nothing was done twice."
            : undefined
        }
      />
    );
  }

  let flagged = false;
  try {
    flagged = await webBasedAdminFlagSetDoNotPromote(
      parsed.postId,
      parsed.magicCookie,
      parsed.username,
      AbortSignal.timeout(mutationTimeoutMs()),
    );
    logLegacyOutcome(path, flagged ? "success" : "failure");
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logLegacyOutcome(
      path,
      timedOut ? "timeout" : "error",
      error instanceof Error ? error.message : String(error),
    );
  }

  return flagged ? (
    <StatusPanel
      tone="success"
      title="This post won't be promoted"
      description="The post is flagged and won't be surfaced for promotion."
    />
  ) : (
    <StatusPanel
      tone="failure"
      title="We couldn't flag that post"
      description="The link may have expired, or the post may already be flagged. Check the post in the admin tools to confirm its current state."
    />
  );
}
