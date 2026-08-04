import {
  AwardIcon,
  BadgeCheckIcon,
  GraduationCapIcon,
  HandshakeIcon,
  MessagesSquareIcon,
  MicIcon,
  Share2Icon,
  TargetIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { ReactNode } from "react";

import Audiences from "@/components/sections/audiences/default";
import CTA from "@/components/sections/cta/default";
import Footer from "@/components/sections/footer/default";
import Hero from "@/components/sections/hero/default";
import Navbar from "@/components/sections/navbar/default";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Partner with MurmurMD to support the physician community and better understand physicians' concerns, preferences, and unmet needs.",
};

/**
 * Unused now that every card carries its own description — kept only as the
 * fallback for cards added without one.
 */
const PLACEHOLDER_BODY =
  "Placeholder body copy. Two or three lines of supporting text sit here, describing what this card offers.";

interface PillarRow {
  icon: ReactNode;
  /** Bold opening phrase; omit for a plain sentence. */
  lead?: string;
  text: string;
}

const PILLAR_ONE_ROWS: PillarRow[] = [
  {
    icon: <AwardIcon className="size-5 stroke-1" />,
    lead: "Expert moderation.",
    text: "Channels are led by high-volume operators and recognized experts who break down new clinical data and share tips and tricks in high-yield posts built for busy physicians.",
  },
  {
    icon: <MessagesSquareIcon className="size-5 stroke-1" />,
    lead: "Case-based discussion.",
    text: "Physicians post cases and questions in focused subspecialty channels — TAVR, Mitral, Tricuspid, Coronary, CTO, LAAC, Shock — and get real-time feedback from peers who do these procedures.",
  },
  {
    icon: <GraduationCapIcon className="size-5 stroke-1" />,
    lead: "Continuous learning.",
    text: "An active peer community keeps physicians current on the topics that matter, between conferences and beyond them.",
  },
];

const PILLAR_TWO_ROWS: PillarRow[] = [
  {
    icon: <MicIcon className="size-5 stroke-1" />,
    text: "We produce in-depth podcasts and video series with world experts on the key topics in interventional and structural cardiology — the trials, techniques, and debates shaping practice.",
  },
  {
    icon: <Share2Icon className="size-5 stroke-1" />,
    text: "Available in-app, on our website, and across YouTube, LinkedIn, and X — extending your reach well beyond our walls.",
  },
];

function PillarRows({ rows }: { rows: PillarRow[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.lead ?? row.text} className="flex gap-3">
          <span className="text-brand mt-0.5 shrink-0">{row.icon}</span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {row.lead && (
              <strong className="text-foreground font-semibold">
                {row.lead}{" "}
              </strong>
            )}
            {row.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

interface BlockCard {
  title: string;
  /** Falls back to PLACEHOLDER_BODY until real copy lands. */
  description?: string;
  /** Cards with no icon and no href render as plain title + text. */
  icon?: ReactNode;
  href?: string;
  linkText?: string;
  /** Content shown beside the heading and body from md up. */
  aside?: ReactNode;
}

interface Block {
  eyebrow: string;
  title: string;
  description?: string;
  /** Stack this block's cards vertically rather than side by side. */
  stacked?: boolean;
  cards: BlockCard[];
}

const BLOCKS: Block[] = [
  {
    eyebrow: "Why traditional channels fall short",
    title: "Physicians are harder to reach than ever",
    description:
      "Cardiologists are overwhelmed. Inboxes are full, rep access is shrinking, and attention is scarce. The channels industry has relied on for decades are losing ground:",
    cards: [
      {
        title: "Conferences are losing pull",
        description:
          "Expensive, time-consuming, and increasingly optional. Physicians attend fewer meetings — and absorb less when they do.",
      },
      {
        title: "Physicians want real-time, practical learning",
        description:
          "Not slide decks. Real cases, tips and tricks, and honest discussion of what's working in the lab right now.",
      },
      {
        title: "Peers drive decisions",
        description:
          "The most trusted signal in medicine is a recommendation from a colleague who's done the case. Peer-to-peer conversation is where opinions form — and where adoption begins.",
      },
    ],
  },
  {
    eyebrow: "Where cardiology talks",
    title: "A daily destination for cardiology's most engaged physicians",
    description:
      "MurmurMD combines an always-on peer community with expert-led long-form content — meeting physicians in the moments that shape their practice.",
    stacked: true,
    cards: [
      {
        icon: <Badge variant="brand-secondary">Pillar 1</Badge>,
        title: "The In-App Community",
        description: "Real cases. Real-time answers. Every day.",
        aside: <PillarRows rows={PILLAR_ONE_ROWS} />,
      },
      {
        icon: <Badge variant="brand-secondary">Pillar 2</Badge>,
        title: "Long-Form Expert Content",
        description: "Deep dives with the field's leading voices.",
        aside: <PillarRows rows={PILLAR_TWO_ROWS} />,
      },
    ],
  },
  {
    eyebrow: "What this means for you",
    title: "Credible engagement, not another impression",
    cards: [
      {
        icon: <BadgeCheckIcon className="size-6 stroke-1" />,
        title: "A verified physician audience",
        description:
          "Every member is a verified practicing physician. No noise, no bots — just the clinicians you're trying to reach.",
      },
      {
        icon: <TargetIcon className="size-6 stroke-1" />,
        title: "Context that matters",
        description:
          "Your field moves on cases and data. So do we. Engage physicians in the exact clinical conversations relevant to your therapy.",
      },
      {
        icon: <HandshakeIcon className="size-6 stroke-1" />,
        title: "Trust by design",
        description:
          "Peer-to-peer discussion is the most credible environment in medicine. Partnerships are built to add value to the conversation, not interrupt it.",
      },
    ],
  },
];

export default function PartnersPage() {
  return (
    <main className="text-foreground min-h-screen w-full">
      <Navbar />
      <Hero
        title="Reach cardiologists where they actually engage"
        // Capped so the headline breaks to two balanced lines on wide screens
        // instead of running out as one. At text-5xl the full line is ~1080px,
        // so 620px forces a second line while staying clear of a third.
        titleClassName="max-w-[620px]"
        description="MurmurMD is the verified, physician-only community where interventional and structural cardiologists discuss real cases, new data, and technique — every day, not once a year."
        badge={false}
        appStoreBadge={false}
        buttons={[
          {
            href: `${siteConfig.links.email}?subject=Partnership%20inquiry`,
            text: "Partner With Us",
            variant: "glow",
          },
        ]}
        mockup={false}
      />
      {BLOCKS.map((block, index) => (
        <Audiences
          key={block.title}
          // Trailing blocks get trimmed top padding so the three read as a
          // group rather than as unrelated sections.
          className={index > 0 ? "pt-4 sm:pt-8 md:pt-12" : undefined}
          eyebrow={block.eyebrow}
          title={block.title}
          description={block.description}
          stacked={block.stacked}
          cards={block.cards.map((card) => ({
            ...card,
            description: card.description ?? PLACEHOLDER_BODY,
          }))}
        />
      ))}
      <CTA
        title="Let's build the future of physician engagement together"
        description="Whether you're launching a device, sharing new trial data, or building awareness with the operators who matter, MurmurMD offers a direct line to cardiology's most engaged community."
        appStoreBadge={false}
        buttons={[
          {
            href: `${siteConfig.links.email}?subject=Partnership%20inquiry`,
            text: "Get in Touch",
            variant: "glow",
          },
        ]}
      />
      <Footer />
    </main>
  );
}
