import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * MurmurMD wordmark (brain/speech-bubble glyph + name). Two files, one per
 * theme: web_logo_light.png is shown on light backgrounds, web_logo_dark.png
 * on dark. Both carry the pink glyph; only the wordmark differs — pink in the
 * light file, white in the dark one.
 *
 * The reengagement email templates hot-link these same two files from
 * murmurmd.com, so replacing either one also changes what SendGrid sends.
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
