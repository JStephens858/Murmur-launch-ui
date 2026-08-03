import { ArrowRightIcon, BriefcaseIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Section } from "../../ui/section";

interface AudienceCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  /** Omit to render a plain, non-interactive card. */
  href?: string;
  linkText?: string;
  /** Content placed beside the heading and body from md up. */
  aside?: ReactNode;
}

interface AudiencesProps {
  /** Small brand-coloured line above the heading; rendered upper-case. */
  eyebrow?: string | false;
  title?: string;
  /** Supporting paragraph under the heading, styled like the hero's. */
  description?: string | false;
  /** Stack the cards vertically instead of laying them out side by side. */
  stacked?: boolean;
  cards?: AudienceCardProps[];
  className?: string;
}

export default function Audiences({
  eyebrow = false,
  title = "Two ways in",
  description = false,
  stacked = false,
  cards = [
    {
      icon: <StethoscopeIcon className="size-6 stroke-1" />,
      title: "For physicians",
      description:
        "Join a verified community of your peers. Share cases, review outcomes, weigh in on polls, and watch conversations with operators who do what you do.",
      href: "/physicians",
      linkText: "Why physicians join",
    },
    {
      icon: <BriefcaseIcon className="size-6 stroke-1" />,
      title: "For industry partners",
      description:
        "We work with companies that want to help the physician community — and to better understand physicians' concerns, preferences, and unmet needs.",
      href: "/partners",
      linkText: "Partner with MurmurMD",
    },
  ],
  className,
}: AudiencesProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-16">
        {/* Grouped so the eyebrow stays tight to its heading rather than being
            pushed away by the section's own gap. */}
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          {eyebrow !== false && (
            <p className="text-brand text-xs font-semibold tracking-widest uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="max-w-[560px] text-center text-2xl leading-tight font-semibold sm:text-4xl sm:leading-tight">
            {title}
          </h2>
          {description !== false && (
            <p className="text-md text-muted-foreground mt-2 max-w-[740px] text-center font-medium text-balance sm:mt-3 sm:text-xl">
              {description}
            </p>
          )}
        </div>
        {/* Two cards sit side by side from sm; three need the wider md
            breakpoint to avoid one wrapping alone onto a second row. Stacked
            keeps a single column at every width, narrowed so full-width rows
            don't run to an unreadable line length. */}
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-4",
            stacked
              ? "max-w-3xl"
              : cards.length >= 3
                ? "max-w-5xl md:grid-cols-3"
                : "max-w-4xl sm:grid-cols-2",
          )}
        >
          {cards.map((card) => {
            const body = (
              <>
                {card.icon && <div className="text-brand">{card.icon}</div>}
                <h3 className="text-xl font-semibold">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-balance">
                  {card.description}
                </p>
                {card.href && card.linkText && (
                  <span className="text-accent-foreground mt-auto flex items-center gap-1 text-sm font-medium">
                    {card.linkText}
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </>
            );
            const shell = "glass-2 flex flex-col gap-4 rounded-xl p-6 sm:p-8";

            // With an aside the card splits into two columns from md; below
            // that the aside drops beneath the copy rather than squeezing it.
            const content = card.aside ? (
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                {/* Roughly a 25/75 split: both grow from a zero basis, so the
                    gap comes out of the shared space rather than overflowing. */}
                <div className="flex flex-col gap-4 md:flex-[1_1_0%]">{body}</div>
                <div className="md:flex-[3_1_0%]">{card.aside}</div>
              </div>
            ) : (
              body
            );

            // Without an href there's nothing to click, so it renders as a
            // plain div — no anchor, no hover affordance.
            return card.href ? (
              <Link
                key={card.title}
                href={card.href}
                className={cn(shell, "group transition-shadow hover:shadow-md")}
              >
                {content}
              </Link>
            ) : (
              <div key={card.title} className={shell}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
