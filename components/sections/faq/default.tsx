import Link from "next/link";
import { ReactNode } from "react";

import { siteConfig } from "@/config/site";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Section } from "../../ui/section";

interface FAQItemProps {
  question: string;
  answer: ReactNode;
  value?: string;
}

interface FAQProps {
  title?: string;
  items?: FAQItemProps[] | false;
  className?: string;
}

export default function FAQ({
  title = "Questions and Answers",
  items = [
    {
      question: "Who can join MurmurMD?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          MurmurMD is for verified physicians. The most active community today
          is interventional cardiology, alongside thoracic surgeons,
          electrophysiologists, radiologists, and colleagues from other
          specialties. If we can&apos;t confirm you&apos;re a physician,
          you&apos;ll be directed here — where anyone can browse our public
          content, including the video library.
        </p>
      ),
    },
    {
      question: "I'm not a physician — what can I do here?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          Browse the{" "}
          <Link href="/videos" className="text-foreground underline">
            video library
          </Link>
          , learn about the platform, or{" "}
          <a
            href={siteConfig.links.email}
            className="text-foreground underline"
          >
            get in touch
          </a>{" "}
          about partnering with us.
        </p>
      ),
    },
    {
      question: "How does physician verification work?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          When you sign up in the app, we confirm you&apos;re a practicing
          physician before you can join the community. Until you&apos;re
          verified, you can still use everything on this website.
        </p>
      ),
    },
    {
      question: "What do industry partners get?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          Medical device and related companies commission long-form and
          short-form video content, run polls of the physician community, and
          receive market-research reports on what physicians are discussing —
          their concerns, preferences, and unmet needs. See{" "}
          <Link href="/partners" className="text-foreground underline">
            Partners
          </Link>{" "}
          for details.
        </p>
      ),
    },
    {
      question: "Can I watch the videos without the app?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          Yes — the full public library is right here on the{" "}
          <Link href="/videos" className="text-foreground underline">
            Videos
          </Link>{" "}
          page. Physicians can also watch inside the app.
        </p>
      ),
    },
  ],
  className,
}: FAQProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8">
        <h2 className="text-center text-3xl font-semibold sm:text-5xl">
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <Accordion type="single" collapsible className="w-full max-w-[800px]">
            {items.map((item, index) => (
              <AccordionItem
                key={item.value ?? item.question}
                value={item.value || `item-${index + 1}`}
              >
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </Section>
  );
}
