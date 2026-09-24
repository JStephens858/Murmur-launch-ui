"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import MurmurMD from "@/components/logos/murmurmd";
import { cn } from "@/lib/utils";

import { MurmurLogoComboIcon } from "./icons";
import { isActivePath, portalNav } from "./nav";
import NavBadge from "./nav-badge";
import { PostButton } from "./post-button";
import { useNavItemClick } from "./use-nav-item-click";

/**
 * Left-hand navigation for the physician portal, laid out the way X does it:
 * a sticky column that shows icons alone on medium screens and icon + label
 * from the xl breakpoint up. Hidden on phones, where PortalBottomBar takes
 * over.
 */
export default function PortalSidebar() {
  const pathname = usePathname();
  const navClick = useNavItemClick();

  return (
    <header className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col items-center px-2 py-2 sm:flex xl:w-[275px] xl:items-start xl:px-3">
      {/* Wordmark once there's room for labels; the post-button mark when
          the column is icons only. */}
      <Link
        href="/feed"
        aria-label="MurmurMD home"
        className="hover:bg-foreground/10 mb-1 flex size-13 items-center justify-center rounded-full transition-colors [--icon-primary:var(--color-primary)] [--icon-secondary:#fff] xl:h-13 xl:w-fit xl:px-3"
      >
        <MurmurLogoComboIcon className="size-10 xl:hidden" />
        {/* Wrapped: the wordmark component carries its own dark:hidden
            toggling, which a breakpoint class on it would override. */}
        <span className="hidden xl:block">
          <MurmurMD className="h-7" />
        </span>
      </Link>

      <nav aria-label="Primary" className="w-full">
        <ul className="flex flex-col items-center gap-1 xl:items-stretch">
          {portalNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = active ? item.activeIcon : item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  onClick={navClick(item)}
                  className={cn(
                    "hover:bg-foreground/10 flex w-fit items-center gap-5 rounded-full p-3 text-xl transition-colors xl:pr-6",
                    active && "font-bold",
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="size-7" />
                    <NavBadge item={item} />
                  </span>
                  <span className="hidden xl:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <PostButton showLabel className="mt-4" />
    </header>
  );
}
