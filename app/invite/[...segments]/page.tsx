import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvitePage from "@/components/legacy/invite-page";
import { recordInviteView } from "@/lib/legacy-invite";
import { parseInvitePath } from "@/lib/legacy-urls";

/**
 * `/invite/4/<code>` — the live invite landing page.
 *
 * A catch-all because legacy discriminated on segment count: `/invite/<code>`
 * and `/invite/<N>/<code>` are the same Express branch, and no App Router
 * dynamic segment can express that.
 *
 * Only variant 4 is served. `/invite/<code>` and the other numeric variants
 * pointed at invite.html / invite2.html / invite3.html, all of which were
 * deleted from Murmur-express's static/ and 404 in production today. Keeping
 * them 404 is deliberate parity; restoring one is a matter of dropping the
 * notFound() and rendering, since the parser already returns the code.
 *
 * The one thing not reproduced: legacy fired createIPInviteLinkage with an
 * EMPTY invite code on the 2-segment form before 404ing, writing junk rows into
 * the attribution table. Nothing fires here unless the page renders.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're invited to MurmurMD",
  robots: { index: false, follow: false },
};

export default async function InviteRoute({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  // Values come from the pathname via the legacy offsets, not from params:
  // Next decodes dynamic segments and legacy did not.
  const { segments } = await params;
  const parsed = parseInvitePath(`/invite/${segments.join("/")}`);

  if (!parsed || parsed.variant !== 4) {
    notFound();
  }

  await recordInviteView(parsed.inviteCode);

  return <InvitePage inviteCode={parsed.inviteCode} />;
}
