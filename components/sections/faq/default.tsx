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
          MurmurMD is a community exclusively for physicians. Every member is
          verified before joining.
        </p>
      ),
    },
    {
      question: "I'm not a physician — what can I do here?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          You can browse the public{" "}
          <Link href="/videos" className="text-foreground underline">
            video library
          </Link>{" "}
          on the web, and industry partners can{" "}
          <a
            href={`${siteConfig.links.email}?subject=Partnership%20inquiry`}
            className="text-foreground underline"
          >
            work with us
          </a>{" "}
          directly. The feed, polls, and discussions are reserved for verified
          physicians.
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
      question: "How do industry partners work with MurmurMD?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          We work with companies that want to help the physician community and
          better understand physicians&apos; concerns, preferences, and unmet
          needs. See{" "}
          <Link href="/partners" className="text-foreground underline">
            Partners
          </Link>{" "}
          to start a conversation, or email us at{" "}
          <a
            href={`${siteConfig.links.email}?subject=Partnership%20inquiry`}
            className="text-foreground underline"
          >
            contact@murmurmd.com
          </a>
          .
        </p>
      ),
    },
    {
      question: "Can I watch the videos without the app?",
      answer: (
        <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
          Yes. The video library is available on the web on the{" "}
          <Link href="/videos" className="text-foreground underline">
            Videos
          </Link>{" "}
          page — long-form conversations and short clips, no app required.
        </p>
      ),
    },
  ],
  className,
}: FAQProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8">
        <h2 className="text-center text-2xl font-semibold sm:text-4xl">
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
