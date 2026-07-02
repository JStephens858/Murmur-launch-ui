import {
  BarChart3Icon,
  ClipboardCheckIcon,
  HeartPulseIcon,
  MessagesSquareIcon,
  PlayIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { ReactNode } from "react";

import { Item, ItemDescription, ItemIcon, ItemTitle } from "../../ui/item";
import { Section } from "../../ui/section";

interface ItemProps {
  title: string;
  description: string;
  icon: ReactNode;
}

interface ItemsProps {
  title?: string;
  items?: ItemProps[] | false;
  className?: string;
}

const DEFAULT_ITEMS: ItemProps[] = [
  {
    title: "Case discussions",
    description:
      "Share interesting cases and walk through decisions with peers who do the same procedures",
    icon: <HeartPulseIcon className="size-5 stroke-1" />,
  },
  {
    title: "Outcome reviews",
    description:
      "Post follow-ups and see how treatment choices actually played out",
    icon: <ClipboardCheckIcon className="size-5 stroke-1" />,
  },
  {
    title: "Recommendations",
    description:
      "Ask for and give practical guidance on devices, technique, and practice",
    icon: <MessagesSquareIcon className="size-5 stroke-1" />,
  },
  {
    title: "Polls",
    description:
      "Commission a poll and see where your colleagues actually stand",
    icon: <BarChart3Icon className="size-5 stroke-1" />,
  },
  {
    title: "Video library",
    description:
      "Long-form conversations and short clips — in the app and on the web",
    icon: <PlayIcon className="size-5 stroke-1" />,
  },
  {
    title: "Physicians only",
    description:
      "Every member is a verified physician. No patients, no PR, no noise",
    icon: <ShieldCheckIcon className="size-5 stroke-1" />,
  },
  {
    title: "Insights for industry",
    description:
      "Partners commission videos and polls, and learn what physicians actually need",
    icon: <TrendingUpIcon className="size-5 stroke-1" />,
  },
  {
    title: "A real community",
    description:
      "Interventional cardiology at the core, with colleagues across specialties",
    icon: <UsersIcon className="size-5 stroke-1" />,
  },
];

export default function Items({
  title = "The conversation you wish happened at conferences",
  items = DEFAULT_ITEMS,
  className,
}: ItemsProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-20">
        <h2 className="max-w-[560px] text-center text-3xl leading-tight font-semibold sm:text-5xl sm:leading-tight">
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <div className="grid auto-rows-fr grid-cols-2 gap-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((item) => (
              <Item key={item.title}>
                <ItemTitle className="flex items-center gap-2">
                  <ItemIcon>{item.icon}</ItemIcon>
                  {item.title}
                </ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </Item>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
