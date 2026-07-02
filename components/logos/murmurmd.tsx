import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * MurmurMD wordmark (brain/speech-bubble glyph + name). Two files, one per
 * theme: web_logo_light.png is shown on light backgrounds, web_logo_dark.png
 * (white wordmark) on dark. The files are currently identical — light needs
 * a dark-text variant from branding.
 */
export default function MurmurMD({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/web_logo_light.png"
        alt="MurmurMD"
        width={470}
        height={106}
        priority
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/web_logo_dark.png"
        alt="MurmurMD"
        width={470}
        height={106}
        priority
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
