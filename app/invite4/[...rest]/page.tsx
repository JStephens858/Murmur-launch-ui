import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InvitePage from "@/components/legacy/invite-page";
import { recordInviteView } from "@/lib/legacy-invite";
import { parseInviteCodeAfterPrefix, PREFIX_LENGTH } from "@/lib/legacy-urls";

/**
 * `/invite4/<code>` — the same landing page as `/invite/4/<code>`, reached by
 * the other URL shape legacy accepted for it.
 *
 * `/invite2/` and `/invite3/` are not ported: their HTML was deleted from
 * Murmur-express's static/ and they 404 in production today.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're invited to MurmurMD",
  robots: { index: false, follow: false },
};

export default async function Invite4Route({
  params,
}: {
  params: Promise<{ rest: string[] }>;
}) {
  const { rest } = await params;
  const inviteCode = parseInviteCodeAfterPrefix(
    `/invite4/${rest.join("/")}`,
    PREFIX_LENGTH.inviteN,
  );

  if (!inviteCode) {
    notFound();
  }

  await recordInviteView(inviteCode);

  return <InvitePage inviteCode={inviteCode} />;
}
