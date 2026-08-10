import { after } from "next/server";

import { rawForwardedFor, rawForwardedForFrom } from "./client-ip";
import { toLinkageCode } from "./legacy-urls";
import { createIPInviteLinkage } from "./murmur-legacy";

/**
 * Records an invite landing for attribution, without making the visitor wait.
 *
 * Legacy never awaited this mutation — the page went out immediately and the
 * request completed whenever it completed. An un-awaited promise in Next can be
 * killed when the response finishes, so `after()` is what preserves that
 * behaviour honestly. It runs the callback after the response flushes, and on a
 * self-hosted long-lived `next start` process it reliably completes.
 *
 * Unlike the two destructive endpoints, this deliberately does NOT go through
 * guardLegacyAction: legacy counted every view, including crawler fetches, so
 * filtering them now would shift the attribution baseline mid-stream.
 */
function scheduleLinkage(
  ip: string | null,
  fullInviteCode: string,
  viewOrClick: "view" | "click",
): void {
  // The mutation rejects anything over six characters, and real codes are
  // seven. Only the recorded value is trimmed; the page always shows the full
  // code. See toLinkageCode.
  const inviteCode = toLinkageCode(fullInviteCode);
  after(async () => {
    try {
      const success = await createIPInviteLinkage(ip, inviteCode, viewOrClick);
      if (!success) {
        // The mutation answers success:false rather than throwing — for a
        // non-admin token, or a code over six characters. That silence is how
        // /invite/4/<code> went years without recording anything.
        console.error(
          JSON.stringify({
            event: "invite-linkage-rejected",
            inviteCode,
            viewOrClick,
            hint: "createIPInviteLinkage returned success:false — check the token's userClass is admin and that the code is <= 6 chars",
          }),
        );
      }
    } catch (error) {
      // Next swallows anything thrown inside after(), so log it explicitly or
      // failures here are invisible.
      console.error(
        JSON.stringify({
          event: "invite-linkage-failed",
          inviteCode,
          viewOrClick,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });
}

/** For pages (Server Components), where the IP comes from headers(). */
export async function recordInviteView(inviteCode: string): Promise<void> {
  // Read the header before scheduling: the request context is not guaranteed to
  // still be available inside the after() callback.
  const ip = await rawForwardedFor();
  scheduleLinkage(ip, inviteCode, "view");
}

/** For the /appstore route handler, which has the request in hand. */
export function recordInviteClick(request: Request, inviteCode: string): void {
  scheduleLinkage(rawForwardedForFrom(request), inviteCode, "click");
}
