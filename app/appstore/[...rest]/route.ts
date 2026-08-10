import { NextResponse } from "next/server";

import { siteConfig } from "@/config/site";
import { recordInviteClick } from "@/lib/legacy-invite";
import { parseInviteCodeAfterPrefix, PREFIX_LENGTH } from "@/lib/legacy-urls";

/**
 * `/appstore/<code>` — records the click, then sends the visitor to the App
 * Store.
 *
 * Legacy served appstore.html, an 11-line page whose entire body was
 * `onload="goToAppStore()"` setting window.location. This answers with a 302 to
 * the identical URL instead: no round trip through a blank page, works with
 * JavaScript disabled, and behaves far more predictably inside the in-app
 * browsers that QR scanners use. Attribution is carried entirely by the pt/ct
 * query parameters, so nothing is lost. The only difference is that the
 * interstitial no longer sits in back-button history.
 *
 * A non-GET never reaches this handler — proxy.ts answers those with a bare 200,
 * which is what stops Next's automatic HEAD-calls-GET aliasing from recording
 * phantom clicks.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rest: string[] }> },
) {
  const { rest } = await params;
  const inviteCode = parseInviteCodeAfterPrefix(
    `/appstore/${rest.join("/")}`,
    PREFIX_LENGTH.appstore,
  );

  // An unreadable code still belongs at the store — the visitor is trying to
  // install the app. Legacy also redirected regardless.
  if (inviteCode) {
    recordInviteClick(request, inviteCode);
  }

  return NextResponse.redirect(siteConfig.appStoreInviteUrl, 302);
}
