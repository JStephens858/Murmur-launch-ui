import type { Metadata } from "next";

import StatusPanel from "@/components/legacy/status-panel";
import { logLegacyOutcome } from "@/lib/legacy-guard";
import { parseEmailVerificationToken } from "@/lib/legacy-urls";
import { adminVerifyEmail, mutationTimeoutMs } from "@/lib/murmur-legacy";

/**
 * `/emailVerification/<userId>_<emailId>` — the link in the address-confirmation
 * email.
 *
 * Legacy awaited the mutation and picked one of two static pages from the
 * result, which this keeps. What it fixes: when the token was malformed,
 * executeEmailVerify fell through every branch without ever touching `res`, so
 * the request hung until the client timed out. A bad token now renders.
 *
 * A catch-all segment reproduces legacy's `parts.pop() || parts.pop()`
 * trailing-slash tolerance.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email verification",
  robots: { index: false, follow: false },
};

export default async function EmailVerificationRoute({
  params,
}: {
  params: Promise<{ token: string[] }>;
}) {
  const { token } = await params;
  const path = `/emailVerification/${token.join("/")}`;
  const parsed = parseEmailVerificationToken(path);

  if (!parsed) {
    logLegacyOutcome(path, "error", "unparseable token");
    return (
      <StatusPanel
        tone="bad-link"
        title="This verification link isn't readable"
        description="The link looks incomplete — email clients sometimes split long links across lines. Try opening it again from the original email, or request a new verification email from the app."
      />
    );
  }

  // Verification is intentionally awaited: the outcome is what the page reports.
  let verified = false;
  try {
    verified = await adminVerifyEmail(
      parsed.userId,
      parsed.emailId,
      AbortSignal.timeout(mutationTimeoutMs()),
    );
    logLegacyOutcome(path, verified ? "success" : "failure");
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logLegacyOutcome(
      path,
      timedOut ? "timeout" : "error",
      error instanceof Error ? error.message : String(error),
    );
  }

  return verified ? (
    <StatusPanel
      tone="success"
      title="Your email address is verified"
      description="You're all set. Head back to the MurmurMD app to keep going."
    />
  ) : (
    <StatusPanel
      tone="failure"
      title="We couldn't verify that email address"
      description="The link may have already been used or expired. Request a new verification email from the app, and it'll send a fresh link."
    />
  );
}
