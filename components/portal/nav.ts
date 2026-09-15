import type { ComponentType } from "react";

import {
  BellFillIcon,
  BellIcon,
  EllipsisCircleFillIcon,
  EllipsisCircleIcon,
  EnvelopeFillIcon,
  EnvelopeIcon,
  FilmFillIcon,
  FilmIcon,
  GridFillIcon,
  GridIcon,
  type IconProps,
  MurmurPulseIcon,
  Person3FillIcon,
  Person3Icon,
  PersonCropRectangleFillIcon,
  PersonCropRectangleIcon,
} from "./icons";

export interface PortalNavItem {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  /** Shown while the item's route is active, like the filled tab icons on X. */
  activeIcon: ComponentType<IconProps>;
  /** Which unread count from the profile badges this item, if any. */
  badge?: "numNotifications" | "numDirectMessages";
}

/**
 * The portal's primary navigation, in sidebar order. Icons are the ones the
 * iOS app uses for the same destinations (MenuView2 / HomeView), exported
 * from SF Symbols by scripts/sf-symbols/build-icons.py.
 */
export const portalNav: PortalNavItem[] = [
  {
    label: "Feed",
    href: "/feed",
    // The app's own pulse mark, its Feed tab icon. Single layer, no fill
    // variant, so the bold label alone marks it active.
    icon: MurmurPulseIcon,
    activeIcon: MurmurPulseIcon,
  },
  {
    label: "Videos",
    href: "/videos",
    icon: FilmIcon,
    activeIcon: FilmFillIcon,
  },
  {
    label: "Explore",
    href: "/explore",
    icon: GridIcon,
    activeIcon: GridFillIcon,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: BellIcon,
    activeIcon: BellFillIcon,
    badge: "numNotifications",
  },
  {
    label: "Groups",
    href: "/groups",
    icon: Person3Icon,
    activeIcon: Person3FillIcon,
  },
  {
    label: "Messages",
    href: "/messages",
    icon: EnvelopeIcon,
    activeIcon: EnvelopeFillIcon,
    badge: "numDirectMessages",
  },
  {
    label: "Profile",
    href: "/profile",
    icon: PersonCropRectangleIcon,
    activeIcon: PersonCropRectangleFillIcon,
  },
  {
    label: "More",
    href: "/more",
    icon: EllipsisCircleIcon,
    activeIcon: EllipsisCircleFillIcon,
  },
];

export const composeHref = "/compose/post";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
