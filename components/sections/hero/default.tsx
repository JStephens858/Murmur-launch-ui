import { ArrowRightIcon } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import AppStoreBadge from "../../ui/app-store-badge";
import { Badge } from "../../ui/badge";
import Glow from "../../ui/glow";
import { LinkButton, type LinkButtonProps } from "../../ui/link-button";
import { Mockup, MockupFrame } from "../../ui/mockup";
import { Section } from "../../ui/section";

interface HeroButtonProps extends Omit<LinkButtonProps, "children"> {
  text: string;
}

interface HeroProps {
  title?: string;
  description?: string;
  mockup?: ReactNode | false;
  badge?: ReactNode | false;
  buttons?: HeroButtonProps[] | false;
  /** Render the official App Store badge ahead of the buttons. */
  appStoreBadge?: boolean;
  className?: string;
}

const DEFAULT_HERO_BUTTONS: HeroButtonProps[] = [
  {
    href: "/videos",
    text: "Browse Videos",
    variant: "glow",
  },
];

const DEFAULT_HERO_BADGE = (
  <Badge variant="outline" className="animate-appear">
    <span className="text-muted-foreground">
      New: the MurmurMD video library
    </span>
    <a href="/videos" className="flex items-center gap-1">
      Watch now
      <ArrowRightIcon className="size-3" />
    </a>
  </Badge>
);

export default function Hero({
  title = "Where physicians talk medicine",
  description = "MurmurMD is the professional community where physicians share cases, compare outcomes, query their peers, and learn from each other.",
  // No app screenshots yet — re-enable the mockup once we have them.
  mockup = false,
  badge = DEFAULT_HERO_BADGE,
  buttons = DEFAULT_HERO_BUTTONS,
  appStoreBadge = true,
  className,
}: HeroProps) {
  return (
    <Section
      className={cn(
        "overflow-hidden",
        // The bottom fade exists to blend into the mockup screenshot; with no
        // mockup it just washes out the buttons.
        mockup !== false ? "fade-bottom pb-0 sm:pb-0 md:pb-0" : "pb-12 sm:pb-24",
        className,
      )}
    >
      <div className="max-w-container mx-auto flex flex-col gap-12 pt-16 sm:gap-24">
        <div className="relative flex flex-col items-center gap-6 text-center sm:gap-12">
          {badge !== false && badge}
          <h1 className="animate-appear from-foreground to-foreground dark:to-muted-foreground relative z-10 inline-block bg-linear-to-r bg-clip-text text-2xl leading-tight font-semibold text-balance text-transparent drop-shadow-2xl sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
            {title}
          </h1>
          <p className="text-md animate-appear text-muted-foreground relative z-10 max-w-[740px] font-medium text-balance opacity-0 delay-100 sm:text-xl">
            {description}
          </p>
          {(appStoreBadge || (buttons !== false && buttons.length > 0)) && (
            <div className="animate-appear relative z-10 flex flex-wrap items-center justify-center gap-4 opacity-0 delay-300">
              {appStoreBadge && <AppStoreBadge />}
              {buttons !== false &&
                buttons.map((button) => (
                <LinkButton
                  key={`${button.href}-${button.text}`}
                  variant={button.variant || "default"}
                  size="lg"
                  href={button.href}
                  icon={button.icon}
                  iconRight={button.iconRight}
                >
                  {button.text}
                </LinkButton>
              ))}
            </div>
          )}
          {mockup !== false && (
            <div className="relative w-full pt-12">
              <MockupFrame
                className="animate-appear opacity-0 delay-700"
                size="small"
              >
                <Mockup
                  type="responsive"
                  className="bg-background/90 w-full rounded-xl border-0"
                >
                  {mockup}
                </Mockup>
              </MockupFrame>
              <Glow
                variant="top"
                className="animate-appear-zoom opacity-0 delay-1000"
              />
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
