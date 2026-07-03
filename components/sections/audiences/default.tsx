import { ArrowRightIcon, BriefcaseIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Section } from "../../ui/section";

interface AudienceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  linkText: string;
}

interface AudiencesProps {
  title?: string;
  cards?: AudienceCardProps[];
  className?: string;
}

export default function Audiences({
  title = "Two ways in",
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
        <h2 className="max-w-[560px] text-center text-2xl leading-tight font-semibold sm:text-4xl sm:leading-tight">
          {title}
        </h2>
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={cn(
                "glass-2 group flex flex-col gap-4 rounded-xl p-6 transition-shadow hover:shadow-md sm:p-8",
              )}
            >
              <div className="text-brand">{card.icon}</div>
              <h3 className="text-xl font-semibold">{card.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-balance">
                {card.description}
              </p>
              <span className="text-accent-foreground mt-auto flex items-center gap-1 text-sm font-medium">
                {card.linkText}
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Section>
  );
}
