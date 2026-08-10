import AppStoreBadge from "@/components/ui/app-store-badge";
import { Section } from "@/components/ui/section";
import { siteConfig } from "@/config/site";

import InviteCodeDisplay from "./invite-code-display";
import LegacyPage from "./legacy-page";

/**
 * The invite landing page, ported from Murmur-express's invite4.html.
 *
 * Same two-step flow as the original — install the app, then hand it the code —
 * because the copy is what the invite emails and printed QR codes lead people to
 * expect. The App Store link goes through /appstore/<code> rather than straight
 * to the store so the click is still recorded, exactly as legacy's
 * appStorePressed() did.
 */
export default function InvitePage({ inviteCode }: { inviteCode: string }) {
  const webUrl = `${siteConfig.url}/invite/4/${inviteCode}`;
  const deepLinkUrl = `${siteConfig.appScheme}://murmurmd.com/invite/4/${inviteCode}`;

  return (
    <LegacyPage>
      <Section className="pb-12 sm:pb-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 pt-16 text-center sm:gap-14">
          <div className="flex flex-col gap-4">
            <h1 className="animate-appear from-foreground to-foreground dark:to-muted-foreground inline-block bg-linear-to-r bg-clip-text text-2xl leading-tight font-semibold text-balance text-transparent sm:text-4xl sm:leading-tight">
              You&rsquo;ve been invited to join MurmurMD
            </h1>
            <p className="text-md animate-appear text-muted-foreground font-medium text-balance opacity-0 delay-100 sm:text-xl">
              MurmurMD is the physician-only community for cases, outcomes, and
              peer learning. Two steps and you&rsquo;re in.
            </p>
          </div>

          <ol className="animate-appear flex w-full flex-col gap-6 text-left opacity-0 delay-200 sm:gap-8">
            <li className="border-border bg-card/50 flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm font-medium">
                  Step 1
                </span>
                <span className="font-medium">Get the app from the App Store</span>
              </div>
              <AppStoreBadge href={`/appstore/${inviteCode}`} />
            </li>

            <li className="border-border bg-card/50 flex flex-col gap-5 rounded-xl border p-6">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm font-medium">
                  Step 2
                </span>
                <span className="font-medium">
                  Once the app is installed, tap your code below on your phone
                  &mdash; or type it into the app to accept the invitation.
                </span>
              </div>
              <InviteCodeDisplay
                inviteCode={inviteCode}
                deepLinkUrl={deepLinkUrl}
                webUrl={webUrl}
              />
            </li>
          </ol>

          <p className="text-muted-foreground animate-appear text-sm opacity-0 delay-300">
            Reading this on a computer? Open this page on your phone to use the
            code, or enter it in the app after installing.
          </p>
        </div>
      </Section>
    </LegacyPage>
  );
}
