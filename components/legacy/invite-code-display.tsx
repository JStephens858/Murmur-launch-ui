"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The tappable invite code from the legacy invite page.
 *
 * Two deliberate changes from invite4.html:
 *  - The code arrives as a prop from the server. Legacy re-derived it in the
 *    browser from window.location.pathname on body onload, which meant a
 *    trailing slash rendered an empty code.
 *  - Copying uses navigator.clipboard instead of building a Range and calling
 *    the deprecated document.execCommand('copy'). Note this needs a secure
 *    context: it works on localhost and over HTTPS, but not over plain http to
 *    a LAN address.
 *
 * Tapping the code hands it to an installed app via the custom scheme. On a
 * device without the app nothing happens visibly, which is why the copy button
 * sits next to it and the page also spells out typing the code by hand.
 */
export default function InviteCodeDisplay({
  inviteCode,
  deepLinkUrl,
  webUrl,
}: {
  inviteCode: string;
  /** com.murmurmd.murmur://… — opens the app straight to the invite. */
  deepLinkUrl: string;
  /** https://murmurmd.com/invite/… — what the copy button puts on the clipboard. */
  webUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(webUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission) — the code is
      // on screen in full, so there's nothing to recover from.
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={deepLinkUrl}
        onClick={() => void copy()}
        className="border-border bg-card hover:border-brand/60 focus-visible:ring-ring inline-block rounded-xl border px-8 py-4 font-mono text-3xl font-semibold tracking-[0.2em] tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-4xl"
        aria-label={`Invite code ${inviteCode.split("").join(" ")} — tap to open in the app`}
      >
        {inviteCode}
      </a>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void copy()}
        className="text-muted-foreground gap-1.5"
      >
        {copied ? (
          <CheckIcon className="size-3.5" aria-hidden />
        ) : (
          <CopyIcon className="size-3.5" aria-hidden />
        )}
        {copied ? "Link copied" : "Copy invite link"}
      </Button>
    </div>
  );
}
