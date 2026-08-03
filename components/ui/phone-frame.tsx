import { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A CSS-drawn iPhone 17 body.
 *
 * Geometry comes from the real device — 149.6 × 71.5 mm body, 6.3" 2622 × 1206
 * display — and is expressed as percentages of the frame's own width, so the
 * bezel, corner radii, Dynamic Island, and side buttons all scale crisply at
 * any size. Percentage padding resolves against width on *every* side, which
 * is what keeps the bezel an even ~2.2mm the whole way around.
 *
 * Drawn rather than dropped in as a PNG so the screen is a real overflow
 * container: content inside it can scroll, and it stays welded to the frame
 * through any 3D transform applied to the whole phone.
 *
 * Corner radii are given as `x / y` pairs — a bare percentage radius would be
 * elliptical on a box this tall.
 */

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
}

/** Display aspect ratio (width / height) — 1206 × 2622. */
export const SCREEN_ASPECT = 1206 / 2622;

export function PhoneFrame({
  children,
  className,
  screenClassName,
}: PhoneFrameProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Side buttons sit behind the body so they read as part of the rail. */}
      <div className="absolute top-[18.5%] -left-[0.9%] h-[4.2%] w-[1.4%] rounded-l-full bg-zinc-400 dark:bg-zinc-600" />
      <div className="absolute top-[25.5%] -left-[0.9%] h-[7.5%] w-[1.4%] rounded-l-full bg-zinc-400 dark:bg-zinc-600" />
      <div className="absolute top-[34.5%] -left-[0.9%] h-[7.5%] w-[1.4%] rounded-l-full bg-zinc-400 dark:bg-zinc-600" />
      <div className="absolute top-[27%] -right-[0.9%] h-[10.5%] w-[1.4%] rounded-r-full bg-zinc-400 dark:bg-zinc-600" />

      {/* Outer rail — the polished aluminium edge. */}
      <div className="shadow-mockup relative bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-300 p-[1.2%] [border-radius:16%_/_7.6%] dark:from-zinc-600 dark:via-zinc-800 dark:to-zinc-700">
        {/* Bezel. */}
        <div className="bg-zinc-950 p-[1.9%] [border-radius:14.8%_/_6.9%]">
          {/* Screen. */}
          <div
            className={cn(
              "relative isolate aspect-[1206/2622] overflow-hidden bg-white [border-radius:12.9%_/_5.9%] dark:bg-zinc-900",
              screenClassName,
            )}
          >
            {children}

            {/* Dynamic Island — 125 × 37pt on a 393pt-wide display. */}
            <div className="absolute top-[1.3%] left-1/2 z-10 h-[4.3%] w-[31%] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}
