import { CheckCircle2Icon, CircleAlertIcon, LinkIcon } from "lucide-react";

import Hero from "@/components/sections/hero/default";
import { Badge } from "@/components/ui/badge";

import LegacyPage from "./legacy-page";

export type StatusTone = "success" | "failure" | "bad-link";

const TONE = {
  success: {
    label: "Done",
    Icon: CheckCircle2Icon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  failure: {
    label: "Didn't work",
    Icon: CircleAlertIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  "bad-link": {
    label: "Broken link",
    Icon: LinkIcon,
    className: "text-muted-foreground",
  },
} as const;

/**
 * Outcome page for the ported action endpoints (/emailVerification,
 * /acceptReengagementPosts, /doNotPromote).
 *
 * Legacy answered these three inconsistently: email verification served one of
 * two static HTML snapshots, while the other two returned plain text `OK <args>`
 * — and did so before knowing whether the mutation had succeeded, since it was
 * never awaited. These pages report the real outcome.
 */
export default function StatusPanel({
  tone,
  title,
  description,
  subdescription,
}: {
  tone: StatusTone;
  title: string;
  description: string;
  subdescription?: string;
}) {
  const { label, Icon, className } = TONE[tone];
  return (
    <LegacyPage>
      <Hero
        badge={
          <Badge variant="outline" className="animate-appear gap-1.5">
            <Icon className={`size-3.5 ${className}`} aria-hidden />
            <span className="text-muted-foreground">{label}</span>
          </Badge>
        }
        title={title}
        description={description}
        subdescription={subdescription ?? false}
        appStoreBadge={false}
        mockup={false}
      />
    </LegacyPage>
  );
}
