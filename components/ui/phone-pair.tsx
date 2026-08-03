import Image from "next/image";
import { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { PhoneFrame, SCREEN_ASPECT } from "./phone-frame";

/** The long feed capture in public/ — roughly seven and a half screens tall. */
const FEED = {
  src: "/feed.png",
  width: 499,
  height: 8187,
  alt: "The MurmurMD feed: physician case posts with images, hashtags, and reactions",
};

/**
 * How far the capture has to travel to bring its last screenful into view.
 * One screen height is (width / SCREEN_ASPECT) in image pixels, so the slice
 * visible at any moment is that over the image's full height — and the pan has
 * to cover everything else.
 */
const visibleFraction = FEED.width / SCREEN_ASPECT / FEED.height;
const scrollEnd = `${(-(1 - visibleFraction) * 100).toFixed(2)}%`;

/** Shared by both phones; only the mirrored transform differs. */
const phoneSize = "w-[207px] shrink-0 sm:w-[225px] lg:w-[261px]";

function FeedImage({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={FEED.src}
      width={FEED.width}
      height={FEED.height}
      alt={FEED.alt}
      sizes="320px"
      /* In the hero and above the fold, so it's the LCP element — leaving it
         lazy costs a visible pop-in on first paint. */
      priority
      className={cn("w-full max-w-none", className)}
      style={style}
    />
  );
}

interface PhonePairProps {
  className?: string;
}

export function PhonePair({ className }: PhonePairProps) {
  return (
    /* Perspective lives on the shared parent so both phones recede toward the
       same vanishing point rather than each having its own. */
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-12 [perspective:1600px] sm:flex-row sm:gap-8 lg:gap-16",
        className,
      )}
    >
      {/* Left: the live feed, panning. Mirrored by the phone at right — each is
          turned to face the centre of the pair, tilted so the two lean apart at
          the top and close at the bottom into a V, then sheared so the inner
          edge drops away and each phone reads as angled into the other. The
          turn is what does the pointing; the shear exaggerates it. Flattened
          below sm, where the phones stack and the 3D just costs legibility. */}
      <PhoneFrame
        className={cn(
          phoneSize,
          "max-sm:[transform:none] sm:[transform:rotateX(4deg)_rotateY(20deg)_rotateZ(-5deg)_skewY(2deg)]",
        )}
      >
        <FeedImage
          className="animate-feed-scroll motion-reduce:animate-none"
          style={{ "--feed-scroll-end": scrollEnd } as CSSProperties}
        />
      </PhoneFrame>

      {/* Right: parked further down the same feed for now — this is the one
          that becomes a flip-through series of app screens. Dropped entirely on
          narrow screens, where a stacked second phone only pushes the call to
          action further down for no extra information. */}
      <PhoneFrame
        className={cn(
          phoneSize,
          "max-sm:hidden sm:[transform:rotateX(4deg)_rotateY(-20deg)_rotateZ(5deg)_skewY(-2deg)]",
        )}
      >
        <FeedImage style={{ transform: "translateY(-24%)" }} />
      </PhoneFrame>
    </div>
  );
}
