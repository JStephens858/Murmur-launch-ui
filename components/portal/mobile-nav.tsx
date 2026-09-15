"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { isActivePath, portalNav } from "./nav";
import NavBadge from "./nav-badge";
import { PostButton } from "./post-button";

/**
 * Phone-width navigation: a hamburger in the upper right opens a drawer
 * with the same items as the sidebar. The post button floats over the
 * content the way it floats over the feed in the iOS app.
 */
export default function PortalMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-2 right-3 z-40 rounded-full sm:hidden"
          >
            <Menu className="size-6" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px]">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <nav aria-label="Primary" className="mt-8">
            <ul className="flex flex-col gap-1">
              {portalNav.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = active ? item.activeIcon : item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "hover:bg-foreground/10 flex items-center gap-4 rounded-full px-3 py-2.5 text-lg transition-colors",
                        active && "font-bold",
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon className="size-7" />
                        <NavBadge item={item} />
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <PostButton showLabel="always" className="mt-6" />
        </SheetContent>
      </Sheet>
      <PostButton className="fixed right-4 bottom-5 z-40 sm:hidden" />
    </>
  );
}
