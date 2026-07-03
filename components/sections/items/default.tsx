import {
  BarChart3Icon,
  ClipboardCheckIcon,
  HeartPulseIcon,
  MessagesSquareIcon,
  PlayIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
      "Poll your colleagues and see where they actually stand",
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
    title: "A real community",
    description:
      "Interventional cardiology at the core, with colleagues across specialties",
    icon: <UsersIcon className="size-5 stroke-1" />,
  },
];

/**
 * The grid is 2/3/4 tiles per row (rendered as 4/6/8 columns with tiles
 * spanning 2), so a partial last row can be centered by offsetting its
 * first tile half a tile-width.
 */
function itemPlacement(index: number, count: number): string {
  const base = count % 2 === 1 && index === count - 1 ? "col-start-2" : null;
  const smRem = count % 3;
  const sm =
    smRem === 1 && index === count - 1
      ? "sm:col-start-3"
      : smRem === 2 && index === count - smRem
        ? "sm:col-start-2"
        : null;
  const lgRem = count % 4;
  const lg =
    lgRem > 0 && index === count - lgRem
      ? { 1: "lg:col-start-4", 2: "lg:col-start-3", 3: "lg:col-start-2" }[
          lgRem as 1 | 2 | 3
        ]
      : null;
  return cn(
    "col-span-2",
    base,
    sm ?? (base && "sm:col-start-auto"),
    lg ?? ((base || sm) && "lg:col-start-auto"),
  );
}

export default function Items({
  title = "The conversation you wish happened at conferences",
  items = DEFAULT_ITEMS,
  className,
}: ItemsProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-20">
        <h2 className="max-w-[560px] text-center text-2xl leading-tight font-semibold sm:text-4xl sm:leading-tight">
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <div className="grid auto-rows-fr grid-cols-4 gap-0 sm:grid-cols-6 sm:gap-4 lg:grid-cols-8">
            {items.map((item, index) => (
              <Item
                key={item.title}
                className={itemPlacement(index, items.length)}
              >
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
